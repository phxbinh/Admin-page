function UserRoleEditor({ user, onChangeRole }) {
  const { h } = window.App.VDOM;
  const { useState } = window.App.Hooks;

  const [nextRole, setNextRole] = useState(user.role);

  return h("div", { style: { minWidth: "160px" } }, [

    h("div", {
      style: {
        fontWeight: "bold",
        marginBottom: "4px",
        color: user.role === "admin" ? "#c0392b" : "#333"
      }
    }, `Role: ${user.role}`),

    h("hr"),

    h("div", { style: { display: "flex", gap: "6px" } }, [

      h("select", {
        onChange: e => setNextRole(e.target.value),
        defaultValue: user.role
      },
        ["-Select Role-", "user", "admin", "moderator"].map(r =>
          h("option", { value: r }, r)
        )
      ),

      h("button", {
        disabled: nextRole === user.role,
        onClick: () => onChangeRole(user, nextRole),
        style: {
          padding: "4px 8px",
          cursor: nextRole === user.role ? "not-allowed" : "pointer"
        }
      }, "Đổi")
    ])
  ]);
}

function AdminUsersPage() {
  const { h } = window.App.VDOM;
  const { useState, useEffect } = window.App.Hooks;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/users");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Fetch users failed");
      }

      setUsers(data);
    } catch (err) {
      setError("Lỗi tải danh sách: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function changeRole(user, newRole) {
    if (newRole === user.role) return;

    if (!confirm(`Đổi role của ${user.email} thành ${newRole}?`)) return;

    try {
      const res = await fetch("/api/change-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, newRole })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Không xác định");
      }

      alert("Đổi role thành công");
      loadUsers();
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  async function deleteUser(user) {
    if (!confirm(`Xóa người dùng ${user.email}?`)) return;

    try {
      const res = await fetch("/api/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Không xác định");
      }

      alert("Xóa thành công");
      loadUsers();
    } catch (err) {
      alert("Lỗi: " + err.message);
    }
  }

  if (loading) {
    return h("div", { id: "loading" }, "Đang tải danh sách người dùng...");
  }

  if (error) {
    return h("div", { style: { color: "red", padding: "20px", textAlign: "center" } }, error);
  }

  return h("div", { class: "container" },
    h("a", { style: { display: "block", textAlign: "center", margin: "16px 0" }, href: "/debug-users"}, "Thông tin đầy đủ"),

    h("h1", null, "Admin - Quản lý người dùng"),

    h("table", null,
      h("thead", null,
        h("tr", null,
          h("th", null, "Email"),
          h("th", null, "User ID"),
          h("th", null, "Role"),
          h("th", null, "Thao tác")
        )
      ),

      h("tbody", null,
        users.map(user =>
          h("tr", { key: user.id },
            h("td", null, user.email),
            h("td", null, user.id.slice(0, 8) + "..."),
            h("td", null,         
              h(UserRoleEditor, {
                user,
                onChangeRole: changeRole
              })
            ),
            h("td", null,
              h("button", {
                onClick: () => deleteUser(user)
              }, "Xóa")
            )
          )
        )
      )
    )
  );
}

// ────────────────────────────────────────────────
//               AUTH + PROTECTION
// ────────────────────────────────────────────────

function AuthPage({ onLoginSuccess }) {
  const { h } = window.App.VDOM;
  const { useState } = window.App.Hooks;

  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signInError } = await window.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      const { data: profile, error: profileError } = await window.supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Không thể lấy thông tin profile");
      }

      if (profile.role !== "admin") {
        await window.supabase.auth.signOut();
        throw new Error("Bạn không có quyền admin để truy cập trang này");
      }

      onLoginSuccess();
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return h("div", { class: "auth-container" },
    h("h2", null, "Đăng nhập Admin"),

    error && h("div", { class: "error-msg" }, error),

    h("form", { onSubmit: handleLogin },
      h("input", {
        type: "email",
        placeholder: "Email",
        value: email,
        onInput: e => setEmail(e.target.value),
        required: true
      }),

      h("input", {
        type: "password",
        placeholder: "Mật khẩu",
        value: password,
        onInput: e => setPassword(e.target.value),
        required: true
      }),

      h("button", {
        type: "submit",
        disabled: loading
      }, loading ? "Đang đăng nhập..." : "Đăng nhập")
    )
  );
}

function AdminLayout({ children }) {
  const { h } = window.App.VDOM;
  const { useState, useEffect } = window.App.Hooks;

  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const { data: { session } } = await window.supabase.auth.getSession();

        if (!session?.user) {
          setIsAdmin(false);
          setChecking(false);
          return;
        }

        const { data: profile } = await window.supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        setIsAdmin(profile?.role === "admin");
      } catch (err) {
        console.error(err);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }

    checkAdmin();

    const { data: listener } = window.supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setIsAdmin(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (checking) {
    return h("div", { id: "loading" }, "Đang kiểm tra quyền truy cập...");
  }

  if (!isAdmin) {
    return h(AuthPage, { onLoginSuccess: () => setIsAdmin(true) });
  }

  return h("div", null,
    h("header", null,
      h("div", null, "Admin Panel"),
      h("button", {
        onClick: async () => {
          await window.supabase.auth.signOut();
          setIsAdmin(false);
        }
      }, "Đăng xuất")
    ),
    children
  );
}

// ────────────────────────────────────────────────
//                  ROUTER
// ────────────────────────────────────────────────

window.App.Router.addRoute("/", () =>
  h(AdminLayout, {children: AdminUsersPage})
  )
);

window.App.Router.init(document.getElementById("app"), { hash: false });