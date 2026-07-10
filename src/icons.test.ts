import { addIcon } from "obsidian";
import { registerTaskHubIcon, TASK_HUB_ICON_ID } from "./icons";

jest.mock("obsidian", () => ({
  addIcon: jest.fn()
}), { virtual: true });

describe("registerTaskHubIcon", () => {
  it("registers the custom Task Hub ribbon icon", () => {
    registerTaskHubIcon();

    expect(addIcon).toHaveBeenCalledWith(TASK_HUB_ICON_ID, expect.stringContaining("<svg"));
    expect(addIcon).toHaveBeenCalledWith(TASK_HUB_ICON_ID, expect.stringContaining("M14.05 15.3 16.55 17.8 20.1 14.25"));
  });
});
