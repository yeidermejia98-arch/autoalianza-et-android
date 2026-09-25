import { supabase } from "./supabaseClient.js";

let currentSession = null;
const listeners = [];

export function onAuthChange(cb) {
  listeners.push(cb);
  if (currentSession !== null) cb(currentSession);
}

function notify() {
  for (const cb of listeners) cb(currentSession);
}

export function getSession() {
  return currentSession;
}

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  currentSession = data.session || undefined;
  notify();
  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    notify();
  });
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
