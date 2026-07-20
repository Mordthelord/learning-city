// AI.B.C — third-person player: WASD/arrows + mouse-orbit camera + jump + sprint.
// Zero-asset friendly: if no model is assigned it builds a capsule "person".
// Swap in a real character later by dropping a prefab into PrefabRegistry.player.
using UnityEngine;

namespace AIBC {
  public class PlayerController : MonoBehaviour {
    [Header("Movement")]
    public float walkSpeed = 5.5f;
    public float sprintSpeed = 9f;
    public float jumpHeight = 1.4f;
    public float gravity = -22f;
    public float turnSmooth = 0.08f;

    [Header("Camera")]
    public float camDistance = 5.5f;
    public float camHeight = 2.0f;
    public float lookSensitivity = 2.6f;

    public static bool InputLocked = false;   // question UI sets this while open

    CharacterController cc;
    Transform cam;
    float yaw, pitch = 12f, yVel, turnVelRef;
    Transform visual;

    void Awake() {
      cc = gameObject.AddComponent<CharacterController>();
      cc.height = 1.8f; cc.radius = 0.35f; cc.center = new Vector3(0, 0.9f, 0);

      // visual body (replaced by a real model when one is assigned)
      var reg = PrefabRegistry.Active;
      if (reg != null && reg.player != null) {
        visual = Instantiate(reg.player, transform).transform;
      } else {
        var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        Destroy(body.GetComponent<Collider>());
        body.transform.SetParent(transform, false);
        body.transform.localPosition = new Vector3(0, 0.9f, 0);
        body.GetComponent<Renderer>().material.color = new Color(0.28f, 0.5f, 0.9f);
        var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        Destroy(head.GetComponent<Collider>());
        head.transform.SetParent(body.transform, false);
        head.transform.localPosition = new Vector3(0, 0.62f, 0);
        head.transform.localScale = Vector3.one * 0.5f;
        head.GetComponent<Renderer>().material.color = new Color(0.95f, 0.78f, 0.6f);
        visual = body.transform;
      }

      // camera
      var camGo = new GameObject("AIBC Camera");
      cam = camGo.transform;
      var c = camGo.AddComponent<Camera>();
      camGo.AddComponent<AudioListener>();
      camGo.tag = "MainCamera";
      yaw = transform.eulerAngles.y;
      Cursor.lockState = CursorLockMode.Locked;
    }

    void Update() {
      if (InputLocked) { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; return; }
      if (Input.GetMouseButtonDown(0) && Cursor.lockState != CursorLockMode.Locked)
        Cursor.lockState = CursorLockMode.Locked;
      if (Input.GetKeyDown(KeyCode.Escape)) Cursor.lockState = CursorLockMode.None;

      if (Cursor.lockState == CursorLockMode.Locked) {
        yaw += Input.GetAxis("Mouse X") * lookSensitivity;
        pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * lookSensitivity, -30f, 65f);
      }

      float h = Input.GetAxisRaw("Horizontal"), v = Input.GetAxisRaw("Vertical");
      Vector3 dir = new Vector3(h, 0, v).normalized;
      float speed = Input.GetKey(KeyCode.LeftShift) ? sprintSpeed : walkSpeed;
      Vector3 move = Vector3.zero;
      if (dir.sqrMagnitude > 0.01f) {
        float targetAngle = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg + yaw;
        float angle = Mathf.SmoothDampAngle(transform.eulerAngles.y, targetAngle, ref turnVelRef, turnSmooth);
        transform.rotation = Quaternion.Euler(0, angle, 0);
        move = Quaternion.Euler(0, targetAngle, 0) * Vector3.forward * speed;
      }
      if (cc.isGrounded) {
        yVel = -2f;
        if (Input.GetKeyDown(KeyCode.Space)) yVel = Mathf.Sqrt(jumpHeight * -2f * gravity);
      }
      yVel += gravity * Time.deltaTime;
      move.y = yVel;
      cc.Move(move * Time.deltaTime);
    }

    void LateUpdate() {
      if (cam == null) return;
      Quaternion rot = Quaternion.Euler(pitch, yaw, 0);
      Vector3 focus = transform.position + Vector3.up * camHeight;
      Vector3 wanted = focus - rot * Vector3.forward * camDistance;
      // don't clip through buildings
      RaycastHit hit;
      if (Physics.Raycast(focus, (wanted - focus).normalized, out hit, camDistance))
        wanted = focus + (wanted - focus).normalized * Mathf.Max(0.6f, hit.distance - 0.25f);
      cam.position = Vector3.Lerp(cam.position, wanted, 1f - Mathf.Exp(-14f * Time.deltaTime));
      cam.rotation = rot;
    }
  }
}
