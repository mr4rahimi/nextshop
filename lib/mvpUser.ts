export function getMvpUserId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mvp_user_id");
}

export function setMvpUserId(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mvp_user_id", userId);
}
