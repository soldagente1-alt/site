import { auth, googleProvider, appleProvider } from "./firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup, createUserWithEmailAndPassword 
} from "firebase/auth";
import { signOut } from "firebase/auth";

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function loginWithApple() {
  return signInWithPopup(auth, appleProvider);
}

export function logout() {
  return signOut(auth);
}

export function createUserWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}