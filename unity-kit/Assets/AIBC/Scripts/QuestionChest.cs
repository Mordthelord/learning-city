// AI.B.C — the question-locked chest: answer right, earn coins. Builds a
// primitive chest when no model is assigned in PrefabRegistry.
using UnityEngine;

namespace AIBC {
  public class QuestionChest : Interactable {
    public int reward = 15;
    public float cooldown = 90f;
    float readyAt;
    Transform lid;

    void Start() {
      prompt = "[E]  Open the Question Chest";
      var reg = PrefabRegistry.Active;
      if (reg != null && reg.chest != null) {
        Instantiate(reg.chest, transform.position, transform.rotation, transform);
      } else {
        var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        body.transform.SetParent(transform, false);
        body.transform.localScale = new Vector3(1f, 0.6f, 0.7f);
        body.transform.localPosition = new Vector3(0, 0.3f, 0);
        body.GetComponent<Renderer>().material.color = new Color(0.5f, 0.33f, 0.16f);
        var lidGo = GameObject.CreatePrimitive(PrimitiveType.Cube);
        lidGo.transform.SetParent(transform, false);
        lidGo.transform.localScale = new Vector3(1.02f, 0.22f, 0.72f);
        lidGo.transform.localPosition = new Vector3(0, 0.7f, 0);
        lidGo.GetComponent<Renderer>().material.color = new Color(0.62f, 0.44f, 0.2f);
        lid = lidGo.transform;
        var band = GameObject.CreatePrimitive(PrimitiveType.Cube);
        band.transform.SetParent(body.transform, false);
        band.transform.localScale = new Vector3(0.2f, 1.05f, 1.05f);
        band.GetComponent<Renderer>().material.color = new Color(0.95f, 0.8f, 0.3f);
      }
    }

    public override void Interact(PlayerController player) {
      if (Time.time < readyAt) { UIHud.Toast("This chest is recharging..."); return; }
      QuestionUI.Ask(firstTry => {
        int coins = firstTry ? reward : Mathf.Max(4, reward / 3);
        CoinWallet.Add(coins, "chest");
        readyAt = Time.time + cooldown;
        if (lid != null) lid.localRotation = Quaternion.Euler(-40, 0, 0);
        Invoke(nameof(CloseLid), cooldown);
      });
    }

    void CloseLid() { if (lid != null) lid.localRotation = Quaternion.identity; }
  }
}
