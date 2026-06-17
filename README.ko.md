# Task Hub

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

Task Hub는 Obsidian 데스크톱 전용 작업 허브 플러그인입니다. Vault의 Markdown 작업, Apple Reminders, Apple Calendar 이벤트, 공개 ICS 캘린더, Dida/TickTick 작업을 하나의 집중된 작업 공간으로 모아 줍니다.

일일 노트, 회의록, 프로젝트 노트, 자료 노트 곳곳에 할 일을 적어 두면서도 한곳에서 검토, 필터링, 일정 변경, 안전한 업데이트를 하고 싶은 사용자에게 맞춰져 있습니다.

![Task Hub calendar overview](assets/task-hub-calendar-overview.png)

## 왜 Task Hub인가요?

Task Hub는 Markdown 작업을 원래 노트에 그대로 두고 전용 작업 공간을 제공합니다. 모든 작업을 별도의 할 일 앱으로 옮기지 않아도 무엇이 예정되어 있는지, 어디에서 왔는지, 어떤 프로젝트 태그에 속하는지 확인할 수 있습니다.

이런 경우에 유용합니다.

- Vault 전체의 `- [ ]` 및 `- [x]` 작업을 모아 보기.
- 작업에서 원본 노트를 열고 원래 줄 근처로 이동하기.
- 목록, 캘린더, 태그 기준으로 작업 검토하기.
- 날짜가 있는 작업과 지원되는 캘린더/리마인더 소스를 함께 보기.
- 외부 소스 쓰기 기능을 명시적인 선택 사항으로 유지하기.

## 주요 기능

- `- [ ]` 및 `- [x]` 형식의 Markdown 작업 인덱싱.
- `📅 YYYY-MM-DD`, `due:: YYYY-MM-DD`, 단독 `YYYY-MM-DD` 날짜 인식.
- 완료 상태, 소스, 태그, 날짜 그룹, 텍스트, 사용자 지정 AND/OR 조건으로 필터링.
- Vault 작업을 완료하기 전에 원본 줄이 여전히 일치하는지 확인.
- 매일, 매주, 매월, 매년 반복 작업 지원.
- 월, 주, 일 캘린더 보기에서 날짜가 있는 작업과 이벤트 표시.
- 지원되는 날짜 토큰이 있는 Markdown 작업을 드래그하여 일정 변경.
- 읽기 전용 공개 ICS 캘린더 추가.
- macOS에서 로컬 helper를 통해 Apple Reminders 및 Apple Calendar 읽기.
- 설정 시 Open API를 통해 Dida/TickTick 작업 동기화.
- 작업 및 캘린더 이벤트에 연결된 로컬 Markdown 노트 만들기.
- 플러그인 UI는 영어, 중국어, 일본어, 한국어, 프랑스어를 지원합니다.

## 지원되는 소스

| 소스 | 읽기 | 선택적 쓰기 | 참고 |
| --- | --- | --- | --- |
| Vault Markdown 작업 | 지원 | 지원되는 작업 줄의 완료, 편집, 삭제, 반복, 드래그 일정 변경 | Markdown에 쓰기 전 원본 줄을 확인합니다. |
| 공개 ICS 캘린더 | 지원 | 미지원 | ICS 이벤트는 읽기 전용입니다. |
| Apple Reminders | macOS 전용 | 활성화 시 완료, 다시 열기, 편집, Markdown에서 생성, 일정 변경 | 로컬 Apple helper와 macOS 권한을 사용합니다. |
| Apple Calendar | macOS 전용 | 활성화 시 이벤트 생성, 편집, 드래그 일정 변경 | 쓰기 가능한 캘린더만 수정하고 읽기 전용 캘린더는 유지합니다. |
| Dida / TickTick | Open API로 지원 | 활성화 시 생성, 편집, 완료, 삭제, 태그 동기화, 드래그 일정 변경 | API 토큰과 설정이 필요합니다. |

쓰기 기능은 설정에서 개별적으로 제어됩니다. 어떤 소스를 읽을 수 있다고 해서 Task Hub가 자동으로 수정하지는 않습니다.

## 호환성

- **Obsidian:** `manifest.json`의 현재 `minAppVersion`은 `1.7.2`입니다. Obsidian 데스크톱 1.7.2 이상을 사용하세요.
- **모바일:** Obsidian 모바일은 지원하지 않습니다.
- **macOS Apple 연동:** Apple Reminders와 Apple Calendar 연동은 macOS 전용입니다. 현재 테스트 지원 범위는 macOS 14 Sonoma 이상입니다.
- **기타 데스크톱 시스템:** Vault 작업, 태그, 캘린더, 공개 ICS, Dida/TickTick 핵심 기능은 Obsidian 데스크톱용입니다. Apple Reminders와 Apple Calendar 기능은 macOS 외 환경에서 사용할 수 없습니다.

## 설치

Task Hub가 Obsidian 커뮤니티 플러그인 디렉터리에서 제공되는 경우 **Settings -> Community plugins -> Browse**에서 설치하세요.

GitHub Release에서 수동 설치하려면:

1. Release에서 `manifest.json`, `main.js`, `styles.css`를 다운로드합니다.
2. Vault 안에 `.obsidian/plugins/task-hub/` 폴더를 만듭니다.
3. 다운로드한 파일을 해당 폴더에 복사합니다.
4. Obsidian을 재시작하거나 커뮤니티 플러그인을 다시 불러온 뒤 **Task Hub**를 활성화합니다.

로컬 Apple Reminders 및 Apple Calendar 지원에는 플러그인 패키지 또는 소스 빌드 경로의 `taskhub-apple-helper` 바이너리가 필요합니다. 표준 커뮤니티 플러그인 Release 자산은 Obsidian이 지원하는 `manifest.json`, `main.js`, `styles.css` 파일로 유지됩니다.

## 일상 사용

리본 아이콘 또는 **Open Task Hub** 명령으로 Task Hub를 엽니다.

작업 보기는 Vault 작업과 지원되는 외부 작업 소스를 하나의 목록으로 모읍니다. 사이드바에서 소스나 태그로 좁히고, 도구 모음에서 완료된 작업 표시, 조건 필터, 텍스트 검색, Vault 재스캔을 사용할 수 있습니다.

캘린더 보기는 날짜가 있는 Markdown 작업, 공개 ICS 이벤트, Apple Calendar 이벤트, Apple Reminders, 사용 가능한 Dida/TickTick 작업을 결합합니다. 월, 주, 일 레이아웃으로 계획 단위를 전환할 수 있습니다. 드래그 일정 변경은 지원되는 소스와 쓰기 설정이 활성화된 경우에만 사용할 수 있습니다.

태그 보기는 Obsidian 스타일 태그별로 작업을 묶어 프로젝트, 컨텍스트, 대기 목록을 검토하기 쉽게 합니다.

작업 노트는 선택 사항인 로컬 Markdown 파일입니다. Task Hub 작업 또는 캘린더 이벤트에 연결되며 YAML frontmatter로 관계를 보이고 이동 가능하게 유지합니다.

## 개인정보와 권한

Task Hub는 로컬 Vault 안의 Markdown 파일을 인덱싱하고 플러그인 설정을 Vault의 Obsidian 플러그인 데이터에 저장합니다.

공개 ICS 소스는 사용자가 설정한 URL만 가져옵니다. Dida/TickTick 연동은 활성화한 경우 설정된 API base로 인증된 HTTPS 요청을 보냅니다.

로컬 Apple 연동은 macOS 데스크톱에서만 실행되며 로컬 데이터를 읽기 전에 macOS에 Reminders 또는 Calendar 접근 권한을 요청합니다. Task Hub는 Apple ID 비밀번호를 요구하지 않으며 iCloud 서버에 직접 연결하지 않습니다. iCloud 동기화는 macOS가 처리합니다.

Obsidian은 기능 권한 경고를 표시할 수 있습니다. Task Hub의 사용 범위는 제한적입니다.

- **Vault 열거:** Markdown 파일에서 작업 줄과 날짜 토큰을 찾습니다.
- **Vault 읽기/쓰기:** 인덱싱을 위해 노트를 읽고, 지원되는 작업을 완료, 편집, 삭제, 일정 변경할 때만 씁니다.
- **파일 시스템 접근:** 플러그인 경로 안의 선택적 로컬 Apple helper를 확인하고 사용합니다.
- **Shell 실행:** Apple 연동을 위해 번들 또는 로컬 빌드된 `taskhub-apple-helper`만 실행합니다.
- **네트워크 요청:** 설정된 ICS URL과 활성화된 Dida/TickTick API에 접근합니다.

설정된 외부 연동을 통해 명시적으로 외부 작업을 만들거나 동기화하지 않는 한, Task Hub는 Vault 작업을 원격 서비스로 보내지 않습니다.

## 현재 제한

Task Hub는 보수적인 범위를 유지합니다.

- Obsidian 모바일은 지원하지 않습니다.
- Obsidian Tasks 플러그인의 전체 문법은 구현되어 있지 않습니다.
- Markdown 작업 자체의 시작/종료 시간 문법은 구현되어 있지 않습니다.
- Google Calendar OAuth 및 Microsoft Calendar OAuth는 포함되어 있지 않습니다.
- 공개 ICS 이벤트는 읽기 전용입니다.
- Apple Reminders, Apple Calendar, Dida/TickTick 쓰기 기능은 명시적으로 활성화해야 합니다.
- Apple helper는 플러그인 패키지 또는 소스 빌드 경로로 제공됩니다. 표준 커뮤니티 플러그인 Release가 추가 helper 자산을 자동 설치한다고 가정하지 마세요.

## 개발

개발 및 Release 세부 정보는 영어 README를 참고하세요: [Development](README.md#development).

## Release 자산

Obsidian 커뮤니티 플러그인 release에서는 GitHub release tag가 `manifest.json`의 `version`과 정확히 일치해야 하며, 다음 첨부 파일을 포함해야 합니다.

- `main.js`
- `manifest.json`
- `styles.css`

저장소 루트에는 Obsidian 제출 흐름에서 요구하는 파일도 유지합니다.

- `README.md`
- `LICENSE`
- `manifest.json`
- `versions.json`

`taskhub-apple-helper` 같은 추가 파일을 커뮤니티 플러그인 GitHub Release에 첨부하지 마세요. Obsidian은 release assets에서 `main.js`, `manifest.json`, `styles.css`만 다운로드합니다.
