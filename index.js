import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const tweetsCollection = collection(db, "tweets");
let tweetsData = [];
let currentUser = null;

const tweetQuery = query(tweetsCollection, orderBy("createdAt", "desc"));

onSnapshot(tweetQuery, (snapshot) => {
  tweetsData = snapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...docSnapshot.data(),
  }));
  render();
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  render();
});

document.addEventListener("click", function (e) {
  if (e.target.dataset.like) {
    handleLikeClick(e.target.dataset.like);
  } else if (e.target.dataset.retweet) {
    handleRetweetClick(e.target.dataset.retweet);
  } else if (e.target.dataset.reply) {
    handleReplyClick(e.target.dataset.reply);
  } else if (e.target.id === "tweet-btn") {
    handleTweetBtnClick();
  } else if (e.target.id === "sign-in-btn") {
    signIn();
  } else if (e.target.id === "sign-out-btn") {
    signOutUser();
  }
});

async function handleLikeClick(tweetId) {
  const targetTweetObj = tweetsData.find((tweet) => tweet.id === tweetId);
  if (!targetTweetObj) return;

  const tweetDocRef = doc(db, "tweets", tweetId);
  await updateDoc(tweetDocRef, {
    likes: increment(targetTweetObj.isLiked ? -1 : 1),
    isLiked: !targetTweetObj.isLiked,
  });
}

async function handleRetweetClick(tweetId) {
  const targetTweetObj = tweetsData.find((tweet) => tweet.id === tweetId);
  if (!targetTweetObj) return;

  const tweetDocRef = doc(db, "tweets", tweetId);
  await updateDoc(tweetDocRef, {
    retweets: increment(targetTweetObj.isRetweeted ? -1 : 1),
    isRetweeted: !targetTweetObj.isRetweeted,
  });
}

function handleReplyClick(replyId) {
  document.getElementById(`replies-${replyId}`).classList.toggle("hidden");
}

async function handleTweetBtnClick() {
  const tweetInput = document.getElementById("tweet-input");

  if (!tweetInput.value) return;

  await addDoc(tweetsCollection, {
    handle: "@Scrimba",
    profilePic: "images/scrimbalogo.png",
    likes: 0,
    retweets: 0,
    tweetText: tweetInput.value,
    replies: [],
    isLiked: false,
    isRetweeted: false,
    createdAt: serverTimestamp(),
  });

  tweetInput.value = "";
}

function signIn() {
  signInWithPopup(auth, provider);
}

function signOutUser() {
  signOut(auth);
}

function getFeedHtml() {
  let feedHtml = "";

  tweetsData.forEach(function (tweet) {
    let likeIconClass = "";
    if (tweet.isLiked) {
      likeIconClass = "liked";
    }

    let retweetIconClass = "";
    if (tweet.isRetweeted) {
      retweetIconClass = "retweeted";
    }

    let repliesHtml = "";
    if (tweet.replies && tweet.replies.length > 0) {
      tweet.replies.forEach(function (reply) {
        repliesHtml += `
<div class="tweet-reply">
  <div class="tweet-inner">
    <img src="${reply.profilePic}" class="profile-pic">
    <div>
      <p class="handle">${reply.handle}</p>
      <p class="tweet-text">${reply.tweetText}</p>
    </div>
  </div>
</div>
`;
      });
    }

    feedHtml += `
<div class="tweet">
  <div class="tweet-inner">
    <img src="${tweet.profilePic}" class="profile-pic">
    <div>
      <p class="handle">${tweet.handle}</p>
      <p class="tweet-text">${tweet.tweetText}</p>
      <div class="tweet-details">
        <span class="tweet-detail">
          <i class="fa-regular fa-comment-dots" data-reply="${tweet.id}"></i>
          ${tweet.replies ? tweet.replies.length : 0}
        </span>
        <span class="tweet-detail">
          <i class="fa-solid fa-heart ${likeIconClass}" data-like="${tweet.id}"></i>
          ${tweet.likes}
        </span>
        <span class="tweet-detail">
          <i class="fa-solid fa-retweet ${retweetIconClass}" data-retweet="${tweet.id}"></i>
          ${tweet.retweets}
        </span>
      </div>
    </div>
  </div>
  <div class="hidden" id="replies-${tweet.id}">
    ${repliesHtml}
  </div>
</div>
`;
  });

  return feedHtml;
}

function getAuthHtml() {
  const authBar = document.getElementById("auth-bar");
  if (!authBar) return;

  if (currentUser) {
    const profilePic = currentUser.photoURL || "images/scrimbalogo.png";
    const displayName =
      currentUser.displayName || currentUser.email || "Signed in";

    authBar.innerHTML = `
      <div class="auth-user">
        <img src="${profilePic}" alt="${displayName}" class="profile-pic auth-pic" />
        <span class="auth-name">${displayName}</span>
        <button id="sign-out-btn" class="auth-button">Sign out</button>
      </div>
    `;
  } else {
    authBar.innerHTML = `<button id="sign-in-btn" class="auth-button">Sign in with Google</button>`;
  }
}

function render() {
  getAuthHtml();

  const tweetInput = document.getElementById("tweet-input");
  const tweetBtn = document.getElementById("tweet-btn");
  if (tweetInput) {
    tweetInput.disabled = !currentUser;
    tweetInput.placeholder = currentUser
      ? "What's happening?"
      : "Sign in to post";
  }
  if (tweetBtn) {
    tweetBtn.disabled = !currentUser;
    tweetBtn.textContent = currentUser ? "Post" : "Sign in to post";
  }

  document.getElementById("feed").innerHTML = getFeedHtml();
}
