// AI.B.C — runtime-built HUD: coin counter, interaction prompt, toasts.
// No scene setup, no prefabs, no TextMeshPro dependency — it builds itself.
using UnityEngine;
using UnityEngine.UI;

namespace AIBC {
  public class UIHud : MonoBehaviour {
    static UIHud I;
    Text coinText, promptText, toastText;
    float toastUntil;

    public static Font DefaultFont() {
      return Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
    }

    public static Canvas NewCanvas(string name, int order) {
      var go = new GameObject(name);
      var c = go.AddComponent<Canvas>();
      c.renderMode = RenderMode.ScreenSpaceOverlay;
      c.sortingOrder = order;
      var scaler = go.AddComponent<CanvasScaler>();
      scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
      scaler.referenceResolution = new Vector2(1280, 720);
      go.AddComponent<GraphicRaycaster>();
      return c;
    }

    public static Text NewText(Transform parent, string s, int size, TextAnchor anchor, Color col) {
      var go = new GameObject("Text");
      go.transform.SetParent(parent, false);
      var t = go.AddComponent<Text>();
      t.font = DefaultFont(); t.text = s; t.fontSize = size;
      t.alignment = anchor; t.color = col; t.fontStyle = FontStyle.Bold;
      t.horizontalOverflow = HorizontalWrapMode.Overflow;
      t.verticalOverflow = VerticalWrapMode.Overflow;
      return t;
    }

    void Awake() {
      I = this;
      var canvas = NewCanvas("AIBC HUD", 10);
      canvas.transform.SetParent(transform, false);

      coinText = NewText(canvas.transform, "Coins: 0", 26, TextAnchor.UpperLeft, Color.white);
      var rt = coinText.rectTransform;
      rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(0, 1);
      rt.anchoredPosition = new Vector2(18, -14);

      promptText = NewText(canvas.transform, "", 22, TextAnchor.LowerCenter, new Color(1f, 0.95f, 0.7f));
      rt = promptText.rectTransform;
      rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0); rt.pivot = new Vector2(0.5f, 0);
      rt.anchoredPosition = new Vector2(0, 90);

      toastText = NewText(canvas.transform, "", 20, TextAnchor.UpperCenter, Color.white);
      rt = toastText.rectTransform;
      rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 1); rt.pivot = new Vector2(0.5f, 1);
      rt.anchoredPosition = new Vector2(0, -18);

      coinText.text = "Coins: " + CoinWallet.Coins;
      CoinWallet.OnChanged += OnCoins;
    }

    void OnDestroy() { CoinWallet.OnChanged -= OnCoins; }
    void OnCoins(int total, int delta) {
      coinText.text = "Coins: " + total;
      if (delta > 0) Toast("+" + delta + " coins!");
    }

    void Update() { if (toastText.text.Length > 0 && Time.time > toastUntil) toastText.text = ""; }

    public static void SetPrompt(string s) { if (I != null) I.promptText.text = s ?? ""; }
    public static void Toast(string s) {
      if (I == null) return;
      I.toastText.text = s; I.toastUntil = Time.time + 2.6f;
    }
  }
}
