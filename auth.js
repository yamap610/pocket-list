import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 產生隨機邀請碼
export function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// 確保使用者有群組，沒有就建立
export async function ensureUserGroup(db, user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists() && userSnap.data().groupId) {
    return userSnap.data().groupId;
  }

  // 建立新群組
  const groupId = "grp_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
  const inviteCode = generateInviteCode();

  await setDoc(doc(db, "groups", groupId), {
    createdBy: user.uid,
    createdAt: Date.now(),
    members: [user.uid],
    memberNames: { [user.uid]: user.displayName || user.email || "使用者" },
    inviteCode: inviteCode,
    inviteExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7天
  });

  await setDoc(userRef, {
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    groupId: groupId,
    joinedAt: Date.now()
  }, { merge: true });

  return groupId;
}

// 用邀請碼加入群組
export async function joinGroupWithCode(db, auth, code) {
  try {
    const groupsRef = collection(db, "groups");
    const q = query(groupsRef, where("inviteCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) return false;

    const groupDoc = snap.docs[0];
    const groupData = groupDoc.data();

    if (groupData.inviteExpiry < Date.now()) return false;

    let user = auth.currentUser;
    if (!user) {
      // 匿名登入再加入
      const result = await signInAnonymously(auth);
      user = result.user;
    }

    await updateDoc(doc(db, "groups", groupDoc.id), {
      members: arrayUnion(user.uid),
      [`memberNames.${user.uid}`]: user.displayName || "家人"
    });

    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      groupId: groupDoc.id,
      joinedAt: Date.now()
    }, { merge: true });

    return true;
  } catch(e) {
    console.error("joinGroupWithCode error:", e);
    return false;
  }
}

// 產生新邀請碼
export async function refreshInviteCode(db, groupId) {
  const code = generateInviteCode();
  await updateDoc(doc(db, "groups", groupId), {
    inviteCode: code,
    inviteExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  return code;
}
