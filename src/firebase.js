import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBDUmFFyosTeJ98ttZmc6iJkTiAsz0Xy0Y",
    authDomain: "my-project-bb4c2.firebaseapp.com",
    projectId: "my-project-bb4c2",
    storageBucket: "my-project-bb4c2.appspot.com",
    messagingSenderId: "612285783227",
    appId: "1:612285783227:web:be3a98f6bf72a3a726dd9e",
    measurementId: "G-L42KJLXTEJ"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

export { storage, db };
