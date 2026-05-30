# 日/周视图时间轴缩放设计

## 背景

Task Hub 的日视图和周视图目前使用固定的 `56px / hour` 纵轴高度。任务和事件都根据这个高度计算 top、height、拖拽落点、点击创建时间和重叠判断。当同一时间段内任务很多时，任务点会变得密集，用户只能依赖重叠摘要展开，无法通过“拉开时间轴”直接看清时间分布。

## 目标

- 在日视图、周视图中支持按住 Command 滚轮缩放纵轴。
- 上滑放大时间轴，下滑压缩时间轴。
- 使用离散档位，不做无级缩放。
- 最粗档支持 2 小时颗粒度，并尽量在无需纵向滚动的情况下显示一天的任务范围。
- 用户可在设置中配置日/周视图的默认显示时间范围，默认 06:00 到 22:00。
- 时间轴缩放不影响真实时间：任务、事件、拖拽、resize、点击创建仍按真实分钟计算，并继续按 15 分钟吸附。

## 非目标

- 不改变月视图。
- 不改变任务或事件的实际时间数据。
- 不引入外部日历或 UI 框架。
- 不做连续缩放动画；第一版只做明确、可测试的离散档位。

## 用户交互

日视图和周视图中：

- `Command + wheel up`：提升缩放档位。
- `Command + wheel down`：降低缩放档位。
- 普通滚轮：保持原有滚动行为。
- 月视图：忽略 Command wheel。

缩放档位：

| 档位 | 名称 | 视觉颗粒度 | 高度策略 |
| --- | --- | --- | --- |
| `fit` | 适配全天 | 2h | 根据可用高度计算 `px/hour`，下限 24px |
| `hour` | 默认 | 1h | 56px/hour |
| `half` | 放大 | 30min | 84px/hour |
| `quarter` | 最大 | 15min | 112px/hour |

`fit` 档仍然渲染真实任务位置，只是主网格更粗，目标是尽量把 06:00-22:00 的默认范围压入当前 pane。

## 设置

新增三个设置：

- `calendarTimeScale`: `"fit" | "hour" | "half" | "quarter"`，默认 `"hour"`。
- `calendarDayStartHour`: `0..23`，默认 `6`。
- `calendarDayEndHour`: `1..24`，默认 `22`。

设置页新增：

- 日/周视图开始时间：下拉 00:00 到 23:00。
- 日/周视图结束时间：下拉 01:00 到 24:00。

如果用户把结束时间设得不大于开始时间，保存/normalize 时自动恢复默认 `06:00-22:00`，避免渲染空范围。

## 时间范围规则

渲染日/周视图时：

1. 以用户设置的开始/结束小时作为基础范围。
2. 如果当天有更早任务/事件，则自动扩展到最早项目所在小时。
3. 如果当天有更晚任务/事件，则自动扩展到最晚项目所在小时的下一小时。
4. 范围最少 1 小时，最大限制在 00:00 到 24:00。

这样设置不会藏掉任务。

## 技术设计

当前代码用模块常量 `HOUR_HEIGHT = 56`。实现时改为运行时上下文：

```ts
type AgendaTimeScale = "fit" | "hour" | "half" | "quarter";

type AgendaTimeMetrics = {
  hourHeight: number;
  minorStepMinutes: 120 | 60 | 30 | 15;
};
```

`renderAgendaGrid` 计算 `hourHeight` 后向下传递到：

- `layoutTimedItems`
- `layoutTimedTaskPoints`
- `taskPointsOverlap`
- `renderTimedCalendarItem`
- `resizeDropTarget`
- `timedCreationTarget`
- `timedDropTarget`
- `adjustedDraggedStartMinutes`
- `dragGrabOffset`

所有像素到分钟、分钟到像素的计算都必须用同一个 `hourHeight`。

CSS 继续使用 `--task-hub-hour-height`，由渲染时设置。辅助网格行由 TypeScript 根据 `minorStepMinutes` 生成：

- `fit`: 2 小时线
- `hour`: 1 小时线
- `half`: 30 分钟线
- `quarter`: 15 分钟线

时间轴标签仍只显示整点，避免 15 分钟档文字过密。

## 可用高度

`fit` 档使用 agenda 容器当前可用高度估算：

- 优先使用 `container.getBoundingClientRect().height`。
- 扣除日/周头部和全天区域的保守高度。
- 计算 `(availableHeight / hourCount)`。
- clamp 到 `24..56px/hour`。

如果 pane 太矮，仍允许纵向滚动，不牺牲可读性。

## 测试策略

单元测试覆盖：

- 旧设置 normalize 后得到默认缩放和 06:00-22:00。
- 无效时间范围恢复默认。
- 日视图 Command wheel 上滑/下滑调用缩放 handler。
- 普通 wheel 不调用缩放 handler。
- 月视图 Command wheel 不调用缩放 handler。
- 不同缩放档位设置不同 `--task-hub-hour-height`。
- 放大后点击时间网格仍换算到正确时间。
- 放大后拖拽/resize 仍按正确分钟换算。
- `fit` 档不会低于最小 hour height。

手工验证：

- 在测试 vault 中切到日视图/周视图。
- 按住 Command 滚轮上滑，观察 1h -> 30min -> 15min，任务间距变大。
- 按住 Command 滚轮下滑，观察 15min -> 30min -> 1h -> 2h/fit。
- 确认普通滚轮仍滚动日历。
- 确认月视图不响应 Command wheel。

## 边界

- Command wheel 事件在 macOS 也可能触发浏览器默认缩放，因此命中日/周视图时必须 `preventDefault()`。
- trackpad delta 可能很小，需要累计 delta，避免一次轻扫跳多个档位。
- 缩放变化后应保持当前视图和日期，不改变选中任务。
- 当前已有“重叠任务摘要不参与拖拽”的修复应保留，因为缩放和重叠展开是相邻交互。
