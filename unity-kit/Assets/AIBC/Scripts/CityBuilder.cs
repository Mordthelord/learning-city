// AI.B.C — builds a walkable city slice from the child's profile:
// plaza, roads, district plots with signs, trees, question chests, NPC walkers.
// 100% primitives until a PrefabRegistry is assigned — then real assets appear
// in the same layout with zero code changes.
using UnityEngine;

namespace AIBC {
  public static class CityBuilder {
    static Material Mat(Color c) {
      // URP-safe unlit-ish lit material
      var sh = Shader.Find("Universal Render Pipeline/Lit");
      if (sh == null) sh = Shader.Find("Standard");
      var m = new Material(sh); m.color = c; return m;
    }

    static GameObject Box(string name, Vector3 pos, Vector3 scale, Color col, Transform parent) {
      var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
      go.name = name;
      go.transform.SetParent(parent, false);
      go.transform.position = pos; go.transform.localScale = scale;
      go.GetComponent<Renderer>().material = Mat(col);
      return go;
    }

    public static void Build(ChildProfile profile, Transform root) {
      var reg = PrefabRegistry.Active;

      // ground + plaza
      var ground = Box("Ground", new Vector3(0, -0.5f, 0), new Vector3(220, 1, 220), new Color(0.36f, 0.62f, 0.3f), root);
      Box("Plaza", new Vector3(0, 0.02f, 0), new Vector3(40, 0.05f, 40), new Color(0.72f, 0.74f, 0.8f), root);
      Box("RoadNS", new Vector3(0, 0.01f, 0), new Vector3(8, 0.04f, 220), new Color(0.25f, 0.26f, 0.3f), root);
      Box("RoadEW", new Vector3(0, 0.015f, 0), new Vector3(220, 0.04f, 8), new Color(0.25f, 0.26f, 0.3f), root);

      // district plots from the SAME selector the web build uses
      var districts = DistrictSelector.Select(profile);
      var plotPos = new Vector3[] {
        new Vector3(-60, 0, -60), new Vector3(60, 0, -60), new Vector3(-60, 0, 60),
        new Vector3(60, 0, 60), new Vector3(-60, 0, 0), new Vector3(60, 0, 0) };
      var plotCols = new Color[] {
        new Color(0.31f, 0.6f, 0.27f), new Color(0.35f, 0.37f, 0.45f), new Color(0.85f, 0.72f, 0.47f),
        new Color(0.33f, 0.55f, 0.62f), new Color(0.55f, 0.4f, 0.62f), new Color(0.62f, 0.5f, 0.35f) };

      for (int i = 0; i < districts.Length && i < plotPos.Length; i++) {
        var plot = Box("District " + districts[i], plotPos[i] + new Vector3(0, 0.03f, 0),
          new Vector3(46, 0.06f, 46), plotCols[i % plotCols.Length], root);

        Sign(districts[i], plotPos[i] + new Vector3(0, 4.5f, -20), root);

        // a couple of buildings per plot
        for (int b = 0; b < 3; b++) {
          Vector3 bp = plotPos[i] + new Vector3(-14 + b * 14, 0, 10);
          GameObject pf = reg != null ? reg.Pick(reg.houses, i * 3 + b) : null;
          if (pf != null) Object.Instantiate(pf, bp, Quaternion.identity, root);
          else {
            float h = 4 + (b * 7 + i * 3) % 6;
            Box("Bldg", bp + new Vector3(0, h / 2, 0), new Vector3(8, h, 8),
              Color.HSVToRGB(((i * 3 + b) * 0.13f) % 1f, 0.25f, 0.85f), root);
          }
        }

        // trees
        for (int t = 0; t < 4; t++) {
          Vector3 tp = plotPos[i] + new Vector3(-18 + t * 12, 0, -12);
          GameObject tf = reg != null ? reg.Pick(reg.trees, i + t) : null;
          if (tf != null) Object.Instantiate(tf, tp, Quaternion.identity, root);
          else {
            Box("Trunk", tp + new Vector3(0, 1, 0), new Vector3(0.5f, 2, 0.5f), new Color(0.42f, 0.3f, 0.17f), root);
            var canopy = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            canopy.transform.SetParent(root, false);
            canopy.transform.position = tp + new Vector3(0, 3.1f, 0);
            canopy.transform.localScale = Vector3.one * 2.6f;
            canopy.GetComponent<Renderer>().material = Mat(new Color(0.25f, 0.55f, 0.25f));
          }
        }

        // one question chest per district — the core loop
        var chestGo = new GameObject("Chest " + districts[i]);
        chestGo.transform.SetParent(root, false);
        chestGo.transform.position = plotPos[i] + new Vector3(0, 0.06f, -6);
        chestGo.AddComponent<QuestionChest>();
      }

      // plaza chest so the loop is 10 seconds from spawn
      var pc = new GameObject("Plaza Chest");
      pc.transform.SetParent(root, false);
      pc.transform.position = new Vector3(6, 0.05f, 6);
      pc.AddComponent<QuestionChest>();

      // ambient NPC walkers
      for (int i = 0; i < 6; i++) {
        var npcGo = new GameObject("NPC " + i);
        npcGo.transform.SetParent(root, false);
        npcGo.transform.position = new Vector3(-30 + i * 12, 0, (i % 2 == 0) ? -16 : 16);
        var w = npcGo.AddComponent<NpcWanderer>();
        w.seed = i;
      }
    }

    static void Sign(string text, Vector3 pos, Transform root) {
      var go = new GameObject("Sign " + text);
      go.transform.SetParent(root, false);
      go.transform.position = pos;
      var tm = go.AddComponent<TextMesh>();
      tm.text = text; tm.fontSize = 48; tm.characterSize = 0.18f;
      tm.anchor = TextAnchor.MiddleCenter; tm.color = Color.white;
      tm.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
      go.GetComponent<MeshRenderer>().material = tm.font.material;
      go.AddComponent<Billboard>();
    }
  }

  public class Billboard : MonoBehaviour {
    void LateUpdate() {
      var cam = Camera.main;
      if (cam != null) transform.rotation = Quaternion.LookRotation(transform.position - cam.transform.position);
    }
  }

  public class NpcWanderer : MonoBehaviour {
    public int seed;
    Vector3 target;
    float speed;

    void Start() {
      speed = 1.2f + (seed % 3) * 0.5f;
      var reg = PrefabRegistry.Active;
      GameObject pf = reg != null ? reg.Pick(reg.npcs, seed) : null;
      if (pf != null) Instantiate(pf, transform);
      else {
        var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        Object.Destroy(body.GetComponent<Collider>());
        body.transform.SetParent(transform, false);
        body.transform.localPosition = new Vector3(0, 0.9f, 0);
        body.GetComponent<Renderer>().material.color =
          Color.HSVToRGB((seed * 0.17f) % 1f, 0.55f, 0.85f);
      }
      PickTarget();
    }

    void PickTarget() {
      target = new Vector3(Random.Range(-80f, 80f), 0, Random.Range(-80f, 80f));
    }

    void Update() {
      Vector3 d = target - transform.position; d.y = 0;
      if (d.magnitude < 1.5f) { PickTarget(); return; }
      transform.position += d.normalized * speed * Time.deltaTime;
      transform.rotation = Quaternion.Slerp(transform.rotation,
        Quaternion.LookRotation(d), 4f * Time.deltaTime);
    }
  }
}
