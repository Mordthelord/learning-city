// AI.B.C — "Rate this game": stars + difficulty vote + optional comment.
// Same schema as the web build, so it lands on the same dashboard.
// Call RateGameCard.Show("quiz_blitz", "Quiz Blitz") after a game ends.
using UnityEngine;
using UnityEngine.UI;

namespace AIBC {
  public class RateGameCard : MonoBehaviour {
    static RateGameCard I;
    GameObject panel;
    Text title;
    Button[] starBtns = new Button[5];
    Text[] starLabels = new Text[5];
    Button[] diffBtns = new Button[3];
    InputField input;
    int stars; string diff, tplId, tplName;
    static readonly string[] DIFF_KEYS = { "easy", "right", "hard" };
    static readonly string[] DIFF_LABELS = { "Too easy", "Just right", "Too hard" };

    void Awake() {
      I = this;
      var canvas = UIHud.NewCanvas("AIBC RateCard", 30);
      canvas.transform.SetParent(transform, false);

      panel = new GameObject("Card");
      panel.transform.SetParent(canvas.transform, false);
      var img = panel.AddComponent<Image>();
      img.color = new Color(0.09f, 0.11f, 0.23f, 0.97f);
      panel.GetComponent<RectTransform>().sizeDelta = new Vector2(460, 330);

      title = UIHud.NewText(panel.transform, "Rate this game!", 24, TextAnchor.MiddleCenter, Color.white);
      title.rectTransform.anchoredPosition = new Vector2(0, 128);

      for (int i = 0; i < 5; i++) {
        int idx = i;
        var go = new GameObject("Star" + i);
        go.transform.SetParent(panel.transform, false);
        var im = go.AddComponent<Image>(); im.color = new Color(0, 0, 0, 0.01f);
        var b = go.AddComponent<Button>();
        go.GetComponent<RectTransform>().sizeDelta = new Vector2(56, 56);
        go.GetComponent<RectTransform>().anchoredPosition = new Vector2(-112 + i * 56, 72);
        starLabels[i] = UIHud.NewText(go.transform, "☆", 40, TextAnchor.MiddleCenter, new Color(1f, 0.85f, 0.3f));
        b.onClick.AddListener(() => {
          stars = idx + 1;
          for (int s = 0; s < 5; s++) starLabels[s].text = s <= idx ? "★" : "☆";
        });
        starBtns[i] = b;
      }

      for (int i = 0; i < 3; i++) {
        int idx = i;
        var go = new GameObject("Diff" + i);
        go.transform.SetParent(panel.transform, false);
        var im = go.AddComponent<Image>(); im.color = new Color(0.14f, 0.17f, 0.34f);
        var b = go.AddComponent<Button>();
        go.GetComponent<RectTransform>().sizeDelta = new Vector2(136, 44);
        go.GetComponent<RectTransform>().anchoredPosition = new Vector2(-146 + i * 146, 8);
        UIHud.NewText(go.transform, DIFF_LABELS[i], 16, TextAnchor.MiddleCenter, Color.white);
        b.onClick.AddListener(() => {
          diff = DIFF_KEYS[idx];
          for (int d = 0; d < 3; d++) diffBtns[d].image.color = d == idx
            ? new Color(0.2f, 0.45f, 0.75f) : new Color(0.14f, 0.17f, 0.34f);
        });
        diffBtns[i] = b;
      }

      var inGo = new GameObject("Input");
      inGo.transform.SetParent(panel.transform, false);
      var inImg = inGo.AddComponent<Image>(); inImg.color = new Color(0.06f, 0.08f, 0.17f);
      inGo.GetComponent<RectTransform>().sizeDelta = new Vector2(400, 44);
      inGo.GetComponent<RectTransform>().anchoredPosition = new Vector2(0, -52);
      input = inGo.AddComponent<InputField>();
      var itext = UIHud.NewText(inGo.transform, "", 16, TextAnchor.MiddleLeft, Color.white);
      itext.rectTransform.sizeDelta = new Vector2(380, 40);
      var ph = UIHud.NewText(inGo.transform, "One thing to make it better? (optional)", 16, TextAnchor.MiddleLeft, new Color(1, 1, 1, 0.4f));
      ph.rectTransform.sizeDelta = new Vector2(380, 40);
      input.textComponent = itext; input.placeholder = ph; input.characterLimit = 140;

      MakeButton("Skip", new Vector2(-110, -118), new Color(0.2f, 0.22f, 0.35f), () => Close(true));
      MakeButton("Send", new Vector2(70, -118), new Color(0.22f, 0.62f, 0.45f), () => {
        GameSession.Rate(tplId, tplName, stars, diff, input.text);
        UIHud.Toast("Thanks! You're making the game better.");
        Close(false);
      });
      panel.SetActive(false);
    }

    void MakeButton(string label, Vector2 pos, Color col, UnityEngine.Events.UnityAction act) {
      var go = new GameObject(label);
      go.transform.SetParent(panel.transform, false);
      var im = go.AddComponent<Image>(); im.color = col;
      var b = go.AddComponent<Button>();
      go.GetComponent<RectTransform>().sizeDelta = new Vector2(label == "Skip" ? 120 : 220, 46);
      go.GetComponent<RectTransform>().anchoredPosition = pos;
      UIHud.NewText(go.transform, label, 18, TextAnchor.MiddleCenter, Color.white);
      b.onClick.AddListener(act);
    }

    public static void Show(string id, string name) {
      if (I == null) return;
      int c = PlayerPrefs.GetInt("aibc_rate_" + id, 0) + 1;
      PlayerPrefs.SetInt("aibc_rate_" + id, c);
      if (c != 2 && !(c > 2 && (c - 2) % 4 == 0)) return;   // 2nd finish, then every 4th
      I.tplId = id; I.tplName = name; I.stars = 0; I.diff = null;
      for (int s = 0; s < 5; s++) I.starLabels[s].text = "☆";
      I.input.text = "";
      I.title.text = "Rate " + name + "!";
      I.panel.SetActive(true);
      PlayerController.InputLocked = true;
    }

    void Close(bool skipped) {
      if (skipped) GameSession.Rate(tplId, tplName, 0, null, null);
      panel.SetActive(false);
      PlayerController.InputLocked = false;
      Cursor.lockState = CursorLockMode.Locked;
    }
  }
}
