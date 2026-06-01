import { didaTagsForTaskHub, extractDidaTitleTags, normalizeDidaTags } from "./didaTags";

describe("dida tags", () => {
  it("keeps Dida native tag bodies separate from Apple Reminder tag normalization", () => {
    expect(normalizeDidaTags(["#比赛", "#p/自习室", "client/acme", "#比赛"])).toEqual([
      "比赛",
      "p/自习室",
      "client/acme"
    ]);
  });

  it("extracts inline hashtags for native Dida tags without replacing slashes", () => {
    expect(extractDidaTitleTags("RPA 学习 #比赛 #p/自习室")).toEqual({
      title: "RPA 学习",
      tags: ["比赛", "p/自习室"]
    });
  });

  it("maps Dida native tags back to Task Hub hashtag display", () => {
    expect(didaTagsForTaskHub(["比赛", "p/自习室"])).toEqual(["#比赛", "#p/自习室"]);
  });
});
