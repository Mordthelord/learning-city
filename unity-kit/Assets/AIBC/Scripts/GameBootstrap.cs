// AI.B.C — THE entry point. New scene → empty GameObject → add this → press Play.
// Builds the whole playable slice with zero assets: city, player, HUD, questions,
// chests, telemetry. Assign a PrefabRegistry when you buy art packs.
using UnityEngine;

namespace AIBC {
  public class GameBootstrap : MonoBehaviour {
    [Header("Assets (optional — primitives until assigned)")]
    public PrefabRegistry prefabs;

    [Header("Profile (replace with real questionnaire fetch in phase 2)")]
    public string childName = "Max";
    public int grade = 4;
    public string subject = "multiplication";
    public string[] interests = { "Sports", "Cars/Vehicles", "Animals/Nature" };

    [Header("Backend")]
    public string backendUrl = "https://learning-city-api.onrender.com";
    public string classCode = "";

    void Start() {
      PrefabRegistry.Active = prefabs;

      // lighting: warm sun so the primitive city already reads friendly
      var sunGo = new GameObject("Sun");
      var sun = sunGo.AddComponent<Light>();
      sun.type = LightType.Directional;
      sun.color = new Color(1f, 0.95f, 0.84f);
      sun.intensity = 1.25f;
      sun.shadows = LightShadows.Soft;
      sunGo.transform.rotation = Quaternion.Euler(48, 35, 0);
      RenderSettings.ambientLight = new Color(0.55f, 0.6f, 0.7f);

      // services
      var services = new GameObject("AIBC Services");
      var api = services.AddComponent<BackendClient>();
      api.baseUrl = backendUrl;
      var qs = services.AddComponent<QuestionService>();
      qs.topic = subject; qs.grade = grade;
      var telem = services.AddComponent<TelemetryClient>();
      telem.baseUrl = backendUrl; telem.classCode = classCode; telem.grade = grade;
      services.AddComponent<UIHud>();
      services.AddComponent<QuestionUI>();
      services.AddComponent<RateGameCard>();

      // the city, from the same profile→districts logic as the web build
      var profile = new ChildProfile {
        childName = childName, grade = grade,
        interests = interests, obsessions = "", subjects = new[] { subject }
      };
      var cityRoot = new GameObject("City").transform;
      CityBuilder.Build(profile, cityRoot);

      // the player
      var player = new GameObject("Player");
      player.transform.position = new Vector3(0, 0.1f, -12);
      player.AddComponent<PlayerController>();
      player.AddComponent<InteractionScanner>();

      GameSession.StartGame("city_freeplay", "City Free Play");
      UIHud.Toast("Welcome to " + childName + "'s Learning City — find a chest and press E!");
    }
  }
}
