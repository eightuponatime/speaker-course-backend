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

export function getMe(): Promise<User> {
  return request<User>("/auth/me");
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", {
    method: "POST"
  });
}
