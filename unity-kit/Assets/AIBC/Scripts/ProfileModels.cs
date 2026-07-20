// AI.B.C — child profile (mirror of the web questionnaire output) + district selection,
// ported from the JS selectDistricts so the Unity city matches the web city's logic.
using System;
using System.Collections.Generic;

namespace AIBC {
  [Serializable] public class ChildProfile {
    public string childName;
    public int grade = 4;
    public string[] interests = new string[0];   // e.g. ["Sports","Cars/Vehicles"]
    public string obsessions = "";               // free text from the parent
    public string[] subjects = new string[0];    // teacher/parent-chosen topics
  }

  public static class DistrictSelector {
    // key, tags (same tag lists as the web build's DISTRICT_CATALOG)
    static readonly (string key, string[] tags, bool always)[] Catalog = {
      ("sports",  new[]{"sport","soccer","basket","foot","base","tennis","gym","swim","athl"}, false),
      ("motor",   new[]{"car","vehicle","race","racing","truck","motor","speed","drive"}, false),
      ("space",   new[]{"space","rocket","planet","star","astro","nasa","galaxy"}, false),
      ("fantasy", new[]{"fantasy","dragon","magic","castle","wizard","knight","story"}, false),
      ("zoo",     new[]{"animal","zoo","dog","cat","dino","nature","wild"}, false),
      ("aqua",    new[]{"water","ocean","sea","fish","swim","beach","boat"}, false),
      ("arcade",  new string[0], true),
      ("camp",    new[]{"camp","fish","hik","outdoor","scout","forest"}, false),
      ("fashion", new[]{"fashion","style","clothes","design","shopping"}, false),
      ("art",     new[]{"art","draw","paint","craft","museum","creat"}, false),
      ("farm",    new[]{"farm","horse","pony","chicken","garden","cook","bak"}, false),
    };

    public static List<string> Select(ChildProfile p) {
      string text = ((p.obsessions ?? "") + " " + string.Join(" ", p.interests ?? new string[0])).ToLowerInvariant();
      var picked = new List<string>();
      foreach (var c in Catalog) {
        bool hit = c.always; foreach (var t in c.tags) if (text.Contains(t)) { hit = true; break; }
        if (hit) picked.Add(c.key);
      }
      // top up to 4 with classic defaults, cap at 8 — same rules as the web build
      string[] fill = { "sports", "zoo", "art", "camp" };
      foreach (var f in fill) { if (picked.Count >= 4) break; if (!picked.Contains(f)) picked.Add(f); }
      if (picked.Count > 8) picked.RemoveRange(8, picked.Count - 8);
      return picked;
    }
  }
}
