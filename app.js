/******************** FIREBASE INIT ********************/
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase, ref, push, set, get, onValue, update, remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/******************** CONFIG ********************/
const firebaseConfig = {
  apiKey: "AIzaSyDwnnT438MxZS_MZgYCkexqO2Xl79lr_ww",
  authDomain: "webex-aa9bc.firebaseapp.com",
  databaseURL: "https://webex-aa9bc-default-rtdb.firebaseio.com",
  projectId: "webex-aa9bc",
  storageBucket: "webex-aa9bc.appspot.com",
  messagingSenderId: "414824337045",
  appId: "1:414824337045:web:8dc5a4c788c6958e0b159c",
  measurementId: "G-JKQS0RCSNH"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/******************** GLOBAL STATE ********************/
let currentUser = null;
let currentTab = "homeTab";

/******************** AUTH ********************/
function autoLogin() {
  signInAnonymously(auth).catch(console.error);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log("Logged in as:", user.uid);
    loadHomeVideos();
  } else {
    autoLogin();
  }
});

/******************** UI NAVIGATION ********************/
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tab-page").forEach(tab => tab.classList.remove("active-page"));
    const tabId = btn.getAttribute("data-tab");
    document.getElementById(tabId).classList.add("active-page");

    currentTab = tabId;
    if (tabId === "homeTab") loadHomeVideos();
    if (tabId === "subscriptionsTab") loadSubscriptions();
    if (tabId === "historyTab") loadHistory();
    if (tabId === "profileTab") loadProfile();
  });
});

/******************** UTIL: Time Ago ********************/
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/******************** HOME VIDEOS ********************/
function loadHomeVideos() {
  const cont = document.getElementById("videoContainer");
  cont.innerHTML = "Loading...";
  get(ref(db, "videos")).then(snap => {
    if (!snap.exists()) {
      cont.innerHTML = "No videos yet.";
      return;
    }
    let videos = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
    videos = videos.sort(() => Math.random() - 0.5); // randomize
    cont.innerHTML = videos.map(v => `
      <div class="video-card" onclick="openPlayer('${v.id}')">
        <img src="${v.thumbnail}" alt="">
        <div class="video-info">
          <img class="channel-logo" src="${v.channelPic || 'https://i.ibb.co/7N0V4fJ/user.png'}" onclick="openChannel('${v.uid}');event.stopPropagation();">
          <div class="video-text">
            <div class="video-title">${v.title}</div>
            <div class="video-author">${v.channelName || "Unknown"}</div>
            <div class="video-time">${timeAgo(v.time)}</div>
          </div>
        </div>
      </div>`).join("");
  });
}

/******************** UPLOAD VIDEO ********************/
document.getElementById("uploadBtn").addEventListener("click", async () => {
  const title = document.getElementById("videoTitle").value.trim();
  const videoUrl = document.getElementById("videoUrl").value.trim();
  const thumbFile = document.getElementById("thumbnailFile").files[0];
  const thumbUrl = document.getElementById("thumbnailUrl").value.trim();

  if (!title || !videoUrl) return alert("Enter title and video URL!");

  let thumbnail = thumbUrl;
  if (thumbFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      thumbnail = e.target.result;
      await saveVideo(title, videoUrl, thumbnail);
    };
    reader.readAsDataURL(thumbFile);
  } else {
    await saveVideo(title, videoUrl, thumbnail);
  }
});

async function saveVideo(title, url, thumbnail) {
  const id = push(ref(db, "videos")).key;
  const data = {
    uid: currentUser.uid,
    title,
    videoUrl: url,
    thumbnail: thumbnail || "https://i.ibb.co/8xkN5xv/no-thumb.png",
    channelName: currentUser.displayName || "Guest",
    channelPic: currentUser.photoURL || "https://i.ibb.co/7N0V4fJ/user.png",
    time: Date.now(),
    likes: 0
  };
  await set(ref(db, "videos/" + id), data);
  document.getElementById("uploadMsg").innerText = "Uploaded!";
  document.getElementById("videoTitle").value = "";
  document.getElementById("videoUrl").value = "";
  document.getElementById("thumbnailUrl").value = "";
  document.getElementById("thumbnailFile").value = "";
  loadHomeVideos();
}

/******************** VIDEO PLAYER ********************/
window.openPlayer = function (id) {
  const popup = document.getElementById("videoPopup");
  popup.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  get(ref(db, "videos/" + id)).then(snap => {
    if (!snap.exists()) return;
    const v = snap.val();
    document.getElementById("videoPlayer").src = v.videoUrl;
    document.getElementById("playerTitle").innerText = v.title;
    document.getElementById("playerChannelName").innerText = v.channelName;
    document.getElementById("playerChannelPic").src = v.channelPic || "";
    document.getElementById("uploadTime").innerText = timeAgo(v.time);
    document.getElementById("likeCount").innerText = v.likes || 0;
    saveHistory(v);
  });

  document.getElementById("closeBtn").onclick = () => {
    popup.classList.add("hidden");
    document.getElementById("videoPlayer").pause();
    document.body.style.overflow = "auto";
  };
};

function saveHistory(v) {
  if (!currentUser) return;
  const hRef = ref(db, "history/" + currentUser.uid + "/" + v.time);
  set(hRef, v);
}

/******************** LIKE SYSTEM ********************/
document.getElementById("likeBtn").addEventListener("click", async () => {
  const title = document.getElementById("playerTitle").innerText;
  const snap = await get(ref(db, "videos"));
  snap.forEach(child => {
    if (child.val().title === title) {
      const vidRef = ref(db, "videos/" + child.key);
      update(vidRef, { likes: (child.val().likes || 0) + 1 });
      document.getElementById("likeCount").innerText = (child.val().likes || 0) + 1;
    }
  });
});

/******************** HISTORY TAB ********************/
function loadHistory() {
  const cont = document.getElementById("historyContainer");
  get(ref(db, "history/" + currentUser.uid)).then(snap => {
    if (!snap.exists()) {
      cont.innerHTML = "No history yet.";
      return;
    }
    const vids = Object.values(snap.val()).reverse();
    cont.innerHTML = vids.map(v => `
      <div class="video-card" onclick="openPlayer('${v.time}')">
        <img src="${v.thumbnail}">
        <div class="video-info">
          <img class="channel-logo" src="${v.channelPic}">
          <div class="video-text">
            <div class="video-title">${v.title}</div>
            <div class="video-author">${v.channelName}</div>
            <div class="video-time">${timeAgo(v.time)}</div>
          </div>
        </div>
      </div>`).join("");
  });
}

/******************** SEARCH ********************/
document.getElementById("searchBtn").addEventListener("click", searchVideos);
function searchVideos() {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  if (!query) return;
  const cont = document.getElementById("videoContainer");
  get(ref(db, "videos")).then(snap => {
    if (!snap.exists()) return;
    const vids = Object.entries(snap.val())
      .filter(([id, v]) => v.title.toLowerCase().includes(query))
      .map(([id, v]) => ({ id, ...v }));
    cont.innerHTML = vids.map(v => `
      <div class="video-card" onclick="openPlayer('${v.id}')">
        <img src="${v.thumbnail}">
        <div class="video-info">
          <img class="channel-logo" src="${v.channelPic}">
          <div class="video-text">
            <div class="video-title">${v.title}</div>
            <div class="video-author">${v.channelName}</div>
          </div>
        </div>
      </div>`).join("");
  });
}

/******************** PLACEHOLDERS for NEXT STEP ********************/
function loadSubscriptions() { /* TODO */ }
function loadProfile() { /* TODO: profile + edit + your videos */ }
window.openChannel = function(uid) { /* TODO: open channel page */ }

console.log("✅ Base app.js loaded — next we’ll add subs, profile, and channel features.");

/******************** AUTH OPTIONS ********************/
document.getElementById("googleSignIn")?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) { console.error(e); }
});

document.getElementById("signOutBtn")?.addEventListener("click", () => {
  signOut(auth);
});

/******************** PROFILE PAGE ********************/
function loadProfile() {
  const pName = document.getElementById("profileName");
  const pPic = document.getElementById("profilePic");
  const pEmail = document.getElementById("profileEmail");

  if (!currentUser) return;
  pName.value = currentUser.displayName || "Guest User";
  pPic.src = currentUser.photoURL || "https://i.ibb.co/7N0V4fJ/user.png";
  pEmail.innerText = currentUser.email || "(anonymous)";

  loadYourVideos();
}

document.getElementById("saveProfile")?.addEventListener("click", async () => {
  const name = document.getElementById("profileName").value.trim();
  const file = document.getElementById("profileFile").files[0];

  let imgBase = currentUser.photoURL || "";
  if (file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      imgBase = e.target.result;
      await updateProfileData(name, imgBase);
    };
    reader.readAsDataURL(file);
  } else {
    await updateProfileData(name, imgBase);
  }
});

async function updateProfileData(name, imgBase) {
  await update(ref(db, "users/" + currentUser.uid), {
    name, photo: imgBase
  });
  currentUser.displayName = name;
  currentUser.photoURL = imgBase;
  document.getElementById("profileMsg").innerText = "✅ Profile updated";
}

/******************** YOUR VIDEOS ********************/
function loadYourVideos() {
  const cont = document.getElementById("yourVideos");
  get(ref(db, "videos")).then(snap => {
    if (!snap.exists()) { cont.innerHTML = "No uploads."; return; }
    const vids = Object.entries(snap.val())
      .filter(([id, v]) => v.uid === currentUser.uid)
      .map(([id, v]) => ({ id, ...v }));
    cont.innerHTML = vids.map(v => `
      <div class="your-video">
        <img src="${v.thumbnail}" onclick="openPlayer('${v.id}')">
        <div class="your-info">
          <input value="${v.title}" id="edit-${v.id}">
          <button onclick="editVideoTitle('${v.id}')">Save</button>
          <button onclick="deleteVideo('${v.id}')">Delete</button>
        </div>
      </div>`).join("");
  });
}

window.editVideoTitle = async function (id) {
  const title = document.getElementById("edit-" + id).value;
  await update(ref(db, "videos/" + id), { title });
  alert("Title updated!");
};

window.deleteVideo = async function (id) {
  if (confirm("Delete this video?")) {
    await remove(ref(db, "videos/" + id));
    loadYourVideos();
  }
};

/******************** CHANNEL PAGE ********************/
window.openChannel = function (uid) {
  const popup = document.getElementById("channelPopup");
  popup.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  get(ref(db, "users/" + uid)).then(userSnap => {
    const user = userSnap.val() || {};
    document.getElementById("chPic").src = user.photo || "https://i.ibb.co/7N0V4fJ/user.png";
    document.getElementById("chName").innerText = user.name || "Unknown Channel";
  });

  get(ref(db, "videos")).then(snap => {
    const cont = document.getElementById("channelVideos");
    const vids = Object.entries(snap.val() || {}).filter(([id, v]) => v.uid === uid);
    cont.innerHTML = vids.map(([id, v]) => `
      <div class="video-card" onclick="openPlayer('${id}')">
        <img src="${v.thumbnail}">
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div class="video-time">${timeAgo(v.time)}</div>
        </div>
      </div>`).join("");
  });

  document.getElementById("closeChannel").onclick = () => {
    popup.classList.add("hidden");
    document.body.style.overflow = "auto";
  };

  // Subscribe button
  document.getElementById("subscribeBtn").onclick = async () => {
    await set(ref(db, `subs/${currentUser.uid}/${uid}`), true);
    alert("Subscribed!");
  };
};

/******************** SUBSCRIPTIONS TAB ********************/
function loadSubscriptions() {
  const cont = document.getElementById("subscriptionsContainer");
  get(ref(db, `subs/${currentUser.uid}`)).then(async (snap) => {
    if (!snap.exists()) {
      cont.innerHTML = "No subscriptions yet.";
      return;
    }
    const subIds = Object.keys(snap.val());
    const allVideosSnap = await get(ref(db, "videos"));
    const allVideos = allVideosSnap.val() || {};
    const vids = Object.entries(allVideos)
      .filter(([id, v]) => subIds.includes(v.uid))
      .map(([id, v]) => ({ id, ...v }));

    cont.innerHTML = vids.map(v => `
      <div class="video-card" onclick="openPlayer('${v.id}')">
        <img src="${v.thumbnail}">
        <div class="video-info">
          <img class="channel-logo" src="${v.channelPic}">
          <div class="video-text">
            <div class="video-title">${v.title}</div>
            <div class="video-author">${v.channelName}</div>
            <div class="video-time">${timeAgo(v.time)}</div>
          </div>
        </div>
      </div>`).join("");
  });
}


/******************** LIKE: ONE PER USER ********************/
document.getElementById("likeBtn").addEventListener("click", async () => {
  const title = document.getElementById("playerTitle").innerText;
  const videosSnap = await get(ref(db, "videos"));
  if (!videosSnap.exists()) return;

  videosSnap.forEach(async (child) => {
    const v = child.val();
    if (v.title === title) {
      const likeRef = ref(db, `likes/${child.key}/${currentUser.uid}`);
      const already = (await get(likeRef)).exists();

      if (already) {
        await remove(likeRef);
        await update(ref(db, "videos/" + child.key), { likes: (v.likes || 1) - 1 });
        document.getElementById("likeCount").innerText = (v.likes || 1) - 1;
      } else {
        await set(likeRef, true);
        await update(ref(db, "videos/" + child.key), { likes: (v.likes || 0) + 1 });
        document.getElementById("likeCount").innerText = (v.likes || 0) + 1;
      }
    }
  });
});

/******************** SEARCH HISTORY ********************/
function addSearchHistory(query) {
  if (!currentUser) return;
  const sRef = ref(db, `searchHistory/${currentUser.uid}/${Date.now()}`);
  set(sRef, query);
}

async function showSearchHistory() {
  const box = document.getElementById("searchHistoryBox");
  if (!currentUser) return;
  const snap = await get(ref(db, `searchHistory/${currentUser.uid}`));
  if (!snap.exists()) {
    box.innerHTML = "<p>No searches yet.</p>";
    return;
  }
  const list = Object.values(snap.val()).reverse().slice(0, 5);
  box.innerHTML = list.map(q => `<div class="history-item" onclick="searchDirect('${q}')">${q}</div>`).join("");
}

window.searchDirect = function (q) {
  document.getElementById("searchInput").value = q;
  searchVideos();
};

document.getElementById("searchBtn").addEventListener("click", () => {
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  if (query) addSearchHistory(query);
  searchVideos();
  showSearchHistory();
});

showSearchHistory();

/******************** RANDOMIZER BUTTON ********************/
const randBtn = document.getElementById("randomizeBtn");
if (randBtn) {
  randBtn.addEventListener("click", () => {
    loadHomeVideos();
  });
}

/******************** NON-SCROLL FULLSCREEN VIDEO ********************/
const playerPopup = document.getElementById("videoPopup");
const videoPlayer = document.getElementById("videoPlayer");

function disableScroll() {
  document.body.style.overflow = "hidden";
}
function enableScroll() {
  document.body.style.overflow = "auto";
}

window.openPlayer = function (id) {
  playerPopup.classList.remove("hidden");
  disableScroll();

  get(ref(db, "videos/" + id)).then(snap => {
    if (!snap.exists()) return;
    const v = snap.val();
    videoPlayer.src = v.videoUrl;
    document.getElementById("playerTitle").innerText = v.title;
    document.getElementById("playerChannelName").innerText = v.channelName;
    document.getElementById("playerChannelPic").src = v.channelPic || "";
    document.getElementById("uploadTime").innerText = timeAgo(v.time);
    document.getElementById("likeCount").innerText = v.likes || 0;
    saveHistory(v);
  });
};

document.getElementById("closeBtn").addEventListener("click", () => {
  playerPopup.classList.add("hidden");
  videoPlayer.pause();
  enableScroll();
});

/******************** SMALL POLISH FIXES ********************/
// Ensure clicking channel logo doesn’t bubble to video open
document.querySelectorAll(".channel-logo").forEach(logo => {
  logo.addEventListener("click", (e) => e.stopPropagation());
});

// Refresh search history on auth change
onAuthStateChanged(auth, () => {
  showSearchHistory();
});

// Fallback default images if none
document.querySelectorAll("img").forEach(img => {
  img.onerror = () => img.src = "https://i.ibb.co/7N0V4fJ/user.png";
});

console.log("✨ Part 3 loaded: Like fix, search history, and polish complete.");