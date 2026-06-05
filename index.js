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
  arrayUnion,
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

// ============================================
// EVENT HANDLER REGISTRY
// ============================================
const eventHandlers = {
  like: (tweetId) => handleLikeClick(tweetId),
  retweet: (tweetId) => handleRetweetClick(tweetId),
  reply: (tweetId) => handleReplyClick(tweetId),
  replySubmit: (tweetId) => handleReplySubmit(tweetId),
  "tweet-btn": () => handleTweetBtnClick(),
  "sign-in-btn": () => signIn(),
  "sign-out-btn": () => signOutUser(),
};

document.addEventListener("click", function (e) {
  // Check dataset attributes
  if (e.target.dataset.like) eventHandlers.like(e.target.dataset.like);
  else if (e.target.dataset.retweet) eventHandlers.retweet(e.target.dataset.retweet);
  else if (e.target.dataset.reply) eventHandlers.reply(e.target.dataset.reply);
  else if (e.target.dataset.replySubmit) eventHandlers.replySubmit(e.target.dataset.replySubmit);
  // Check element IDs
  else if (e.target.id in eventHandlers) eventHandlers[e.target.id]();
});

// ============================================
// LIKE & RETWEET HANDLERS
// ============================================
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

// ============================================
// REPLY HANDLERS
// ============================================
function handleReplyClick(replyId) {
  document.getElementById(`replies-${replyId}`).classList.toggle("hidden");
}

async function handleReplySubmit(tweetId) {
  if (!currentUser) return;

  const replyInput = document.querySelector(`[data-reply-input="${tweetId}"]`);
  if (!replyInput || !replyInput.value.trim()) return;

  const displayName =
    currentUser.displayName ||
    (currentUser.email && currentUser.email.split("@")[0]) ||
    "anonymous";
  const handleName = displayName.startsWith("@")
    ? displayName
    : `@${displayName.replace(/\s+/g, "")}`;
  const profilePic = currentUser.photoURL || "images/scrimbalogo.png";

  const tweetDocRef = doc(db, "tweets", tweetId);
  await updateDoc(tweetDocRef, {
    replies: arrayUnion({
      handle: handleName,
      profilePic: profilePic,
      tweetText: replyInput.value.trim(),
      createdAt: new Date(),
    }),
  });

  replyInput.value = "";
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function formatTimestamp(createdAt) {
  if (!createdAt) return "";

  let date;
  if (createdAt.toDate) {
    date = createdAt.toDate();
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === "string") {
    date = new Date(createdAt);
  } else {
    return "";
  }

  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// ============================================
// TWEET HANDLERS
// ============================================
async function handleTweetBtnClick() {
  const tweetInput = document.getElementById("tweet-input");

  if (!tweetInput.value) return;

  const displayName =
    (currentUser &&
      (currentUser.displayName ||
        (currentUser.email && currentUser.email.split("@")[0]))) ||
    "anonymous";
  const handleName = displayName.startsWith("@")
    ? displayName
    : `@${displayName.replace(/\s+/g, "")}`;
  const profilePic =
    (currentUser && currentUser.photoURL) || "images/scrimbalogo.png";

  await addDoc(tweetsCollection, {
    handle: handleName,
    profilePic: profilePic,
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

// ============================================
// AUTH HANDLERS
// ============================================
function signIn() {
  signInWithPopup(auth, provider);
}

function signOutUser() {
  signOut(auth);
}

// ============================================
// RENDER FUNCTIONS
// ============================================
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
  <div class="tweet-reply-content">
      <p class="handle">${reply.handle}</p>
      <p class="tweet-text">${reply.tweetText}</p>
      <p class="tweet-time">${formatTimestamp(reply.createdAt)}</p>
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
      <p class="tweet-time">${formatTimestamp(tweet.createdAt)}</p>
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
    <div class="reply-form">
      <textarea
        class="reply-input"
        data-reply-input="${tweet.id}"
        placeholder="Write a reply..."
        ${currentUser ? "" : "disabled"}
      ></textarea>
      <button
        class="reply-submit"
        data-reply-submit="${tweet.id}"
        ${currentUser ? "" : "disabled"}
      >Reply</button>
      ${currentUser ? "" : '<p class="reply-login-text">Sign in to reply.</p>'}
    </div>
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

  const inputProfilePic = document.getElementById("input-profile-pic");
  if (inputProfilePic) {
    inputProfilePic.src =
      currentUser && currentUser.photoURL
        ? currentUser.photoURL
        : "images/scrimbalogo.png";
  }

  document.getElementById("feed").innerHTML = getFeedHtml();
}
