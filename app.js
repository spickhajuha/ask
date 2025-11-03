
// ===============================
// Firebase Imports
// ===============================
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  remove,
  get,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";

// ===============================
// Firebase Init
// ===============================
const app = getApp();
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUserId = null;
let lastOpenedFromChannel = null;
let currentVideoId = null;
let currentChannelId = null;

// ===============================
// Auth Handling
// ===============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserId = user.uid;
    hideLoginPopup();
    loadUserData();
    loadAllVideos();
  } else {
    currentUserId = null;
  }
});

// ===============================
// Login Popup
// ===============================
const loginPopup = document.getElementById("loginPopup");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const closeLoginPopup = document.getElementById("closeLoginPopup");

function showLoginPopup() {
  loginPopup.classList.remove("hidden");
}
function hideLoginPopup() {
  loginPopup.classList.add("hidden");
}

googleLoginBtn.onclick = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await set(ref(db, "users/" + user.uid), {
      name: user.displayName,
      logo: user.photoURL,
    });
    currentUserId = user.uid;
    hideLoginPopup();
    loadUserData();
    loadAllVideos();
  } catch (err) {
    alert("Sign-in failed: " + err.message);
  }
};
closeLoginPopup.onclick = hideLoginPopup;

// ===============================
// DOM Elements
// ===============================
const pages = {
  home: document.getElementById("homePage"),
  history: document.getElementById("historyPage"),
  subs: document.getElementById("subsPage"),
  upload: document.getElementById("uploadPage"),
  profile: document.getElementById("profilePage"),
  channel: document.getElementById("channelPage"),
  video: document.getElementById("videoPage"),
};

const tabs = {
  home: document.getElementById("homeTab"),
  history: document.getElementById("historyTab"),
  subs: document.getElementById("subsTab"),
  upload: document.getElementById("uploadTab"),
  profile: document.getElementById("profileTab"),
};

const homeVideos = document.getElementById("homeVideos");
const historyVideos = document.getElementById("historyVideos");
const subsVideos = document.getElementById("subsVideos");
const userVideos = document.getElementById("userVideos");
const channelVideos = document.getElementById("channelVideos");
const recommendedVideos = document.getElementById("recommendedVideos");

const uploadForm = document.getElementById("uploadForm");
const uploadMsg = document.getElementById("uploadMsg");

const profileImg = document.getElementById("profileImg");
const profileUpload = document.getElementById("profileUpload");
const profileName = document.getElementById("profileName");
const editProfileBtn = document.getElementById("editProfileBtn");
const editProfileSection = document.getElementById("editProfileSection");
const newProfileName = document.getElementById("newProfileName");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");

const player = document.getElementById("player");
const playerTitle = document.getElementById("playerTitle");
const playerChannelLogo = document.getElementById("playerChannelLogo");
const playerChannelName = document.getElementById("playerChannelName");
const playerUploadTime = document.getElementById("playerUploadTime");
const subscribeUnderBtn = document.getElementById("subscribeUnderBtn");
const likeBtn = document.getElementById("likeBtn");
const likeCount = document.getElementById("likeCount");
const commentBtn = document.getElementById("commentBtn");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentList = document.getElementById("commentList");
const closePlayer = document.getElementById("closePlayer");
const subscribeBtn = document.getElementById("subscribeBtn");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

// ===============================
// Navigation
// ===============================
function showPage(page) {
  Object.values(pages).forEach((p) => (p.style.display = "none"));
  page.style.display = "block";

  const disableSearch =
    page === pages.channel ||
    page === pages.history ||
    page === pages.subs ||
    page === pages.upload ||
    page === pages.profile ||
    page === pages.video;

  searchInput.disabled = disableSearch;
  searchBtn.disabled = disableSearch;
}

function setActiveTab(activeTab) {
  Object.values(tabs).forEach((t) => t.classList.remove("active"));
  activeTab.classList.add("active");
}

// ===============================
// Tabs Events
// ===============================
tabs.home.onclick = () => {
  showPage(pages.home);
  setActiveTab(tabs.home);
  loadAllVideos();
};
tabs.history.onclick = () => {
  if (!currentUserId) return showLoginPopup();
  showPage(pages.history);
  setActiveTab(tabs.history);
  loadHistory();
};
tabs.subs.onclick = () => {
  if (!currentUserId) return showLoginPopup();
  showPage(pages.subs);
  setActiveTab(tabs.subs);
  loadSubscriptions();
};
tabs.upload.onclick = () => {
  if (!currentUserId) return showLoginPopup();
  showPage(pages.upload);
  setActiveTab(tabs.upload);
};
tabs.profile.onclick = () => {
  if (!currentUserId) return showLoginPopup();
  showPage(pages.profile);
  setActiveTab(tabs.profile);
  loadUserVideos();
};

// ===============================
// Logout
// ===============================
logoutBtn.onclick = async () => {
  await signOut(auth);
  alert("Signed out successfully!");
  currentUserId = null;
  showPage(pages.home);
  setActiveTab(tabs.home);
};

// ===============================
// Utility Functions
// ===============================
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// ===============================
// Upload
// ===============================
uploadForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUserId) return showLoginPopup();

  const title = document.getElementById("videoTitle").value.trim();
  const thumbFile = document.getElementById("thumbFile").files[0];
  const thumbUrl = document.getElementById("thumbUrl").value.trim();
  const videoFile = document.getElementById("videoFile").files[0];
  const videoUrl = document.getElementById("videoUrl").value.trim();

  uploadMsg.innerText = "Uploading...";
  try {
    let finalThumb = thumbUrl;
    let finalVideo = videoUrl;
    if (thumbFile) finalThumb = await fileToBase64(thumbFile);
    if (videoFile) finalVideo = await fileToBase64(videoFile);

    const vidRef = push(ref(db, "videos"));
    await set(vidRef, {
      id: vidRef.key,
      title,
      thumbnail: finalThumb,
      videoUrl: finalVideo,
      uploaderId: currentUserId,
      uploaderName: profileName.innerText || "User",
      uploaderLogo: profileImg.src,
      likes: 0,
      likedBy: {},
      createdAt: Date.now(),
    });

    uploadMsg.innerText = "✅ Uploaded successfully!";
    uploadForm.reset();
  } catch {
    uploadMsg.innerText = "❌ Upload failed";
  }
};

// ===============================
// Load All Videos
// ===============================
function loadAllVideos() {
  const loader = document.getElementById("homeLoader");
  loader.style.display = "flex";
  homeVideos.innerHTML = "";

  onValue(ref(db, "videos"), (snap) => {
    const data = snap.val();
    homeVideos.innerHTML = "";
    loader.style.display = "none";
    if (!data) {
      homeVideos.innerHTML = `<p style="text-align:center;color:#aaa;">No videos yet.</p>`;
      return;
    }
    Object.values(data)
      .sort((a, b) => b.createdAt - a.createdAt)
      .forEach((v) => homeVideos.appendChild(createVideoCard(v)));
  });
}

// ===============================
// Create Video Card
// ===============================
function createVideoCard(v, isUserVideo = false) {
  const div = document.createElement("div");
  div.className = "video-card neon-border";
  div.innerHTML = `
    <img src="${v.thumbnail}" class="video-thumb">
    <div class="video-info">
      <img src="${v.uploaderLogo}" class="channel-logo" data-uid="${v.uploaderId}">
      <div class="video-text">
        <p class="video-title">${v.title}</p>
        <p class="video-author">${v.uploaderName}</p>
        <p class="upload-time">${timeAgo(v.createdAt)}</p>
      </div>
    </div>
  `;

  // Edit/Delete in profile
  if (isUserVideo) {
    const actions = document.createElement("div");
    actions.className = "video-actions-mini";
    actions.innerHTML = `
      <button class="edit-btn"><i class="fa fa-pen"></i></button>
      <button class="delete-btn"><i class="fa fa-trash"></i></button>
    `;
    div.appendChild(actions);

    actions.querySelector(".edit-btn").onclick = async (e) => {
      e.stopPropagation();
      const newTitle = prompt("Enter new title:", v.title);
      if (!newTitle) return;
      await update(ref(db, "videos/" + v.id), { title: newTitle });
    };

    actions.querySelector(".delete-btn").onclick = async (e) => {
      e.stopPropagation();
      if (confirm("Delete this video?")) await remove(ref(db, "videos/" + v.id));
    };
  }

  div.onclick = (e) => {
    if (e.target.classList.contains("channel-logo"))
      openChannel(v.uploaderId, v.uploaderName, v.uploaderLogo);
    else openPlayer(v);
  };
  return div;
}

// ===============================
// Player (Fullscreen style)
// ===============================
function openPlayer(v) {
  currentVideoId = v.id;
  currentChannelId = v.uploaderId;

  showPage(pages.video);
  document.querySelector("header").style.display = "none";
  document.querySelector("nav.bottom-nav").style.display = "none";

  const loader = document.getElementById("videoLoader");
  loader.style.display = "flex";

  player.src = v.videoUrl;
  player.load();
  player.addEventListener("loadeddata", () => {
    loader.style.display = "none";
    player.play().catch(() => (player.controls = true));
  });

  playerTitle.innerText = v.title;
  playerChannelLogo.src = v.uploaderLogo;
  playerChannelName.innerText = v.uploaderName;
  playerUploadTime.innerText = timeAgo(v.createdAt);
  likeCount.innerText = v.likes || 0;

  updateSubscribeButton(subscribeUnderBtn, v.uploaderId);
  saveToHistory(v);
  loadComments(v.id);
  loadRecommended(v.id);

  // hide comments initially
  document.getElementById("commentsSection").classList.add("hidden");
}

closePlayer.onclick = () => {
  player.pause();
  player.src = "";
  document.querySelector("header").style.display = "flex";
  document.querySelector("nav.bottom-nav").style.display = "flex";
  if (lastOpenedFromChannel)
    openChannel(lastOpenedFromChannel.id, lastOpenedFromChannel.name, lastOpenedFromChannel.logo);
  else {
    showPage(pages.home);
    setActiveTab(tabs.home);
  }
};

// ===============================
// Like / Comments
// ===============================
likeBtn.onclick = async () => {
  if (!currentUserId) return showLoginPopup();
  const refV = ref(db, `videos/${currentVideoId}`);
  const snap = await get(refV);
  if (!snap.exists()) return;
  const v = snap.val();
  const likedBy = v.likedBy || {};
  if (likedBy[currentUserId]) return;
  likedBy[currentUserId] = true;
  const likes = (v.likes || 0) + 1;
  await update(refV, { likes, likedBy });
  likeCount.innerText = likes;
};

// Comment button toggles comment section
commentBtn.onclick = () => {
  if (!currentUserId) return showLoginPopup();
  const section = document.getElementById("commentsSection");
  section.classList.toggle("hidden");
  if (!section.classList.contains("hidden")) {
    section.scrollIntoView({ behavior: "smooth" });
  }
};

commentForm.onsubmit = async (e) => {
  e.preventDefault();
  if (!currentUserId) return showLoginPopup();
  const text = commentInput.value.trim();
  if (!text) return;
  const refC = push(ref(db, `comments/${currentVideoId}`));
  await set(refC, {
    text,
    userName: profileName.innerText,
    userLogo: profileImg.src,
    createdAt: Date.now(),
  });
  commentInput.value = "";
};

function loadComments(id) {
  onValue(ref(db, `comments/${id}`), (snap) => {
    commentList.innerHTML = "";
    const d = snap.val();
    if (d) {
      Object.values(d).forEach((c) => {
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;">
            <img src="${c.userLogo}" width="22" height="22" style="border-radius:50%">
            <b>${c.userName}</b>
          </div>
          <p style="margin-left:28px;color:#ff8844">${c.text}</p>`;
        commentList.appendChild(el);
      });
    }
  });
}

// ===============================
// Recommended, History, Subs, Profile
// ===============================
function loadRecommended(id) {
  onValue(ref(db, "videos"), (snap) => {
    const d = snap.val();
    recommendedVideos.innerHTML = "";
    if (d)
      Object.values(d)
        .filter((v) => v.id !== id)
        .slice(0, 6)
        .forEach((v) => recommendedVideos.appendChild(createVideoCard(v)));
  });
}

async function saveToHistory(v) {
  if (!currentUserId) return;
  await set(ref(db, `history/${currentUserId}/${v.id}`), v);
}

function loadHistory() {
  onValue(ref(db, `history/${currentUserId}`), (snap) => {
    historyVideos.innerHTML = "";
    const d = snap.val();
    if (d)
      Object.values(d).forEach((v) => historyVideos.appendChild(createVideoCard(v)));
  });
}

async function loadSubscriptions() {
  const sSnap = await get(ref(db, `subscriptions/${currentUserId}`));
  if (!sSnap.exists()) {
    subsVideos.innerHTML = "<p>No subscriptions yet.</p>";
    return;
  }
  const subs = Object.keys(sSnap.val());
  onValue(ref(db, "videos"), (snap) => {
    const d = snap.val();
    subsVideos.innerHTML = "";
    if (d)
      Object.values(d)
        .filter((v) => subs.includes(v.uploaderId))
        .forEach((v) => subsVideos.appendChild(createVideoCard(v)));
  });
}

function loadUserVideos() {
  onValue(ref(db, "videos"), (snap) => {
    userVideos.innerHTML = "";
    const d = snap.val();
    if (d)
      Object.values(d)
        .filter((v) => v.uploaderId === currentUserId)
        .forEach((v) => userVideos.appendChild(createVideoCard(v, true)));
  });
}

// ===============================
// Subscriptions
// ===============================
subscribeUnderBtn.onclick = () => {
  if (!currentUserId) return showLoginPopup();
  toggleSubscribe(currentChannelId);
};
if (subscribeBtn)
  subscribeBtn.onclick = () => {
    if (!currentUserId) return showLoginPopup();
    toggleSubscribe(currentChannelId);
  };

async function toggleSubscribe(uid) {
  const sRef = ref(db, `subscriptions/${currentUserId}/${uid}`);
  const snap = await get(sRef);
  if (snap.exists()) await remove(sRef);
  else await set(sRef, true);
  updateSubscribeButton(subscribeUnderBtn, uid);
  updateSubscribeButton(subscribeBtn, uid);
}

async function updateSubscribeButton(btn, uid) {
  if (!btn) return;
  const snap = await get(ref(db, `subscriptions/${currentUserId}/${uid}`));
  btn.innerHTML = snap.exists()
    ? `<i class="fa-solid fa-bell-slash"></i> Subscribed`
    : `<i class="fa-solid fa-bell"></i> Subscribe`;
}

// ===============================
// Channel Page
// ===============================
function openChannel(uid, name, logo) {
  lastOpenedFromChannel = { id: uid, name, logo };
  showPage(pages.channel);
  document.querySelector("header").style.display = "flex";
  document.querySelector("nav.bottom-nav").style.display = "flex";
  document.getElementById("channelName").innerText = name;
  document.getElementById("channelLogo").src = logo;
  currentChannelId = uid;
  updateSubscribeButton(subscribeBtn, uid);

  onValue(ref(db, "videos"), (snap) => {
    const d = snap.val();
    channelVideos.innerHTML = "";
    if (d)
      Object.values(d)
        .filter((v) => v.uploaderId === uid)
        .forEach((v) => channelVideos.appendChild(createVideoCard(v)));
  });
}

// ===============================
// Profile Update
// ===============================
editProfileBtn.onclick = () =>
  editProfileSection.classList.toggle("hidden");

profileImg.onclick = () => profileUpload.click();

profileUpload.onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const base64 = await fileToBase64(f);
  profileImg.src = base64;
  await update(ref(db, "users/" + currentUserId), { logo: base64 });
};

saveProfileBtn.onclick = async () => {
  const n = newProfileName.value.trim();
  if (!n) return;
  profileName.innerText = n;
  await update(ref(db, "users/" + currentUserId), { name: n });
  editProfileSection.classList.add("hidden");
};

function loadUserData() {
  onValue(ref(db, "users/" + currentUserId), (snap) => {
    const d = snap.val();
    if (d) {
      if (d.name) profileName.innerText = d.name;
      if (d.logo) profileImg.src = d.logo;
    }
  });
}

// ===============================
// Search
// ===============================
searchBtn.onclick = async () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return;
  if (currentUserId)
    await set(ref(db, `searchHistory/${currentUserId}/${Date.now()}`), {
      query: q,
    });

  onValue(ref(db, "videos"), (snap) => {
    const d = snap.val();
    homeVideos.innerHTML = "";
    if (d) {
      const results = Object.values(d).filter((v) =>
        v.title.toLowerCase().includes(q)
      );
      if (results.length)
        results.forEach((v) =>
          homeVideos.appendChild(createVideoCard(v))
        );
      else
        homeVideos.innerHTML =
          `<p style="text-align:center;color:#aaa;">No videos found.</p>`;
    }
  });
};

// ===============================
// Utility: Time Ago
// ===============================
function timeAgo(timestamp) {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000);
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(months / 12);
  return `${years} yr ago`;
}

// ===============================
// App Init
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  showPage(pages.home);
  setActiveTab(tabs.home);
  loadAllVideos();
});


