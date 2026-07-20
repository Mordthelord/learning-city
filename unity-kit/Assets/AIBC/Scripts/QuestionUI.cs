// AI.B.C — the question panel. Runtime-built uGUI: prompt + answer buttons,
// wrong answers explain and let the child retry (every miss teaches).
// Reports to GameSession + QuestionService, then hands the result back.
using UnityEngine;
using UnityEngine.UI;

namespace AIBC {
  public class QuestionUI : MonoBehaviour {
    static QuestionUI I;
    Canvas canvas;
    Text promptText, feedback;
    GameObject panel;
    Button[] buttons = new Button[4];
    Text[] labels = new Text[4];
    QuestionItem current;
    bool firstTry;
    float openedAt;
    System.Action<bool> onDone;

    void Awake() {
      I = this;
      canvas = UIHud.NewCanvas("AIBC QuestionUI", 20);
      canvas.transform.SetParent(transform, false);
      if (Object.FindFirstObjectByType<UnityEngine.EventSystems.EventSystem>() == null) {
        var es = new GameObject("EventSystem");
        es.AddComponent<UnityEngine.EventSystems.EventSystem>();
        es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>();
      }

      panel = new GameObject("Panel");
      panel.transform.SetParent(canvas.transform, false);
      var img = panel.AddComponent<Image>();
      img.color = new Color(0.07f, 0.09f, 0.2f, 0.96f);
      var rt = panel.GetComponent<RectTransform>();
      rt.sizeDelta = new Vector2(560, 360);
      rt.anchoredPosition = Vector2.zero;

      promptText = UIHud.NewText(panel.transform, "", 26, TextAnchor.MiddleCenter, Color.white);
      promptText.rectTransform.anchoredPosition = new Vector2(0, 120);

      for (int i = 0; i < 4; i++) {
        int idx = i;
        var bgo = new GameObject("Answer" + i);
        bgo.transform.SetParent(panel.transform, false);
        var bimg = bgo.AddComponent<Image>();
        bimg.color = new Color(0.16f, 0.2f, 0.42f);
        var b = bgo.AddComponent<Button>();
        var brt = bgo.GetComponent<RectTransform>();
        brt.sizeDelta = new Vector2(240, 62);
        brt.anchoredPosition = new Vector2(i % 2 == 0 ? -130 : 130, 30 - (i / 2) * 78);
        labels[i] = UIHud.NewText(bgo.transform, "", 24, TextAnchor.MiddleCenter, Color.white);
        b.onClick.AddListener(() => Answer(idx));
        buttons[i] = b;
      }

      feedback = UIHud.NewText(panel.transform, "", 19, TextAnchor.MiddleCenter, new Color(1f, 0.8f, 0.5f));
      feedback.rectTransform.anchoredPosition = new Vector2(0, -140);
      panel.SetActive(false);
    }

    public static void Ask(System.Action<bool> done) {
      if (I == null || QuestionService.I == null) return;
      I.Show(QuestionService.I.Next(), done);
    }

    void Show(QuestionItem q, System.Action<bool> done) {
      current = q; onDone = done; firstTry = true; openedAt = Time.time;
      promptText.text = q.target;
      feedback.text = "";
      int n = Mathf.Min(4, q.answers.Length);
      for (int i = 0; i < 4; i++) {
        bool on = i < n;
        buttons[i].gameObject.SetActive(on);
        buttons[i].image.color = new Color(0.16f, 0.2f, 0.42f);
        if (on) labels[i].text = q.answers[i];
      }
      panel.SetActive(true);
      PlayerController.InputLocked = true;
    }

    void Answer(int idx) {
      bool right = labels[idx].text == current.correct;
      if (right) {
        buttons[idx].image.color = new Color(0.2f, 0.65f, 0.35f);
        QuestionService.I.ReportAnswer(firstTry);
        GameSession.RecordAnswer(firstTry, QuestionService.I.Tier, Time.time - openedAt);
        feedback.text = firstTry ? "Correct — nailed it!" : "Got there! That one comes back later.";
        Invoke(nameof(Close), 0.8f);
      } else {
        buttons[idx].image.color = new Color(0.75f, 0.25f, 0.25f);
        if (firstTry) { firstTry = false; }
        feedback.text = "Not yet — the answer to " + current.target + " is " + current.correct + ". Try it!";
      }
    }

    void Close() {
      panel.SetActive(false);
      PlayerController.InputLocked = false;
      Cursor.lockState = CursorLockMode.Locked;
      var cb = onDone; onDone = null;
      if (cb != null) cb(firstTry);
    }
  }
}
