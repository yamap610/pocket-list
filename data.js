import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 即時監聽群組的所有地點
export function subscribeToPlaces(db, groupId, callback) {
  const q = query(
    collection(db, "groups", groupId, "places"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const places = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(places);
  });
}

// 新增地點
export async function addPlace(db, groupId, data, userDisplayName) {
  return await addDoc(collection(db, "groups", groupId, "places"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userDisplayName || "你",
    visited: false
  });
}

// 更新地點
export async function updatePlace(db, groupId, placeId, data) {
  return await updateDoc(doc(db, "groups", groupId, "places", placeId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

// 刪除地點
export async function deletePlace(db, groupId, placeId) {
  return await deleteDoc(doc(db, "groups", groupId, "places", placeId));
}

// 匯出資料（JSON）
export function exportData(places) {
  const data = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    count: places.length,
    places: places.map(p => ({
      name: p.name,
      region: p.region,
      category: p.category,
      tags: p.tags || [],
      mapLink: p.mapLink || "",
      sourceLink: p.sourceLink || "",
      photoUrl: p.photoUrl || "",
      note: p.note || "",
      visited: p.visited || false,
      createdBy: p.createdBy || ""
    }))
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `口袋名單備份_${new Date().toLocaleDateString("zh-TW").replace(/\//g,"-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 匯入資料（JSON）
export async function importData(db, groupId, jsonText, userDisplayName) {
  try {
    const data = JSON.parse(jsonText);
    const places = data.places || data; // 支援舊格式
    let count = 0;
    for (const p of places) {
      await addPlace(db, groupId, p, userDisplayName);
      count++;
    }
    return { success: true, count };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
