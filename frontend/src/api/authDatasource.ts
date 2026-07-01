import { request } from "./http";
import type { User } from "../entities/course/course";

export function login(email: string, password: string): Promise<User> {
  return request<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function register(input: { email: string; password: string; fullName: string }): Promise<User> {
  return request<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      full_name: input.fullName
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function registerWithInvitationCode(input: {
  code: string;
  email: string;
  password: string;
  fullName: string;
}): Promise<User> {
  return request<User>("/auth/register/invitation", {
    method: "POST",
    body: JSON.stringify({
      code: input.code,
      email: input.email,
      password: input.password,
      full_name: input.fullName
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

export function updateMe(input: { email: string; fullName: string }): Promise<User> {
  return request<User>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify({
      email: input.email,
      full_name: input.fullName
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  repeatPassword: string;
}): Promise<void> {
  return request<void>("/auth/me/password", {
    method: "PATCH",
    body: JSON.stringify({
      current_password: input.currentPassword,
      new_password: input.newPassword,
      repeat_password: input.repeatPassword
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function deleteMe(): Promise<void> {
  return request<void>("/auth/me", {
    method: "DELETE"
  });
}

export function forgotPassword(email: string): Promise<void> {
  return request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", {
    method: "POST"
  });
}
