import { getStorage } from "firebase/storage";
import app from "./firebaseApp";

export const storage = getStorage(app, "gs://soldagente-30f00.firebasestorage.app");
