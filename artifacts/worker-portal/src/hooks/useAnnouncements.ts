import { useMemo } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Announcement } from "@/lib/types";
import {
  useCollection,
  setDocWithDiagnostic,
  updateDocWithDiagnostic,
  deleteDocWithDiagnostic,
  logFirestoreDiagnostic,
} from "./use-portal";

export function useAnnouncements(options?: { includeInactive?: boolean }) {
  const includeInactive = options?.includeInactive ?? false;
  const { data, loading, error } = useCollection<Announcement>(
    "announcements",
    [],
    true,
    { field: "createdAt", direction: "desc" }
  );

  const announcements = useMemo(() => {
    if (includeInactive) {
      return data;
    }
    return data.filter((a) => a.isActive !== false);
  }, [data, includeInactive]);

  return { data: announcements, allData: data, loading, error };
}

export async function createAnnouncement(payload: {
  title: string;
  content: string;
  badge?: string;
  isActive?: boolean;
}) {
  if (!db) throw new Error("Firebase is not configured.");
  const title = payload.title?.trim();
  const content = payload.content?.trim();
  if (!title) throw new Error("Judul pengumuman wajib diisi.");
  if (!content) throw new Error("Isi pengumuman wajib diisi.");

  const newRef = doc(collection(db, "announcements"));
  const dataToSave: Record<string, unknown> = {
    id: newRef.id,
    title,
    content,
    badge: payload.badge?.trim() || null,
    isActive: payload.isActive ?? true,
    createdBy: auth?.currentUser?.uid ?? "admin",
    createdAt: serverTimestamp(),
  };

  await setDocWithDiagnostic(newRef, dataToSave, undefined, "createAnnouncement");
  return newRef.id;
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<{
    title: string;
    content: string;
    badge: string;
    isActive: boolean;
  }>
) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!id) throw new Error("ID pengumuman tidak valid.");

  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (payload.title !== undefined) {
    if (!payload.title.trim()) throw new Error("Judul pengumuman wajib diisi.");
    updates.title = payload.title.trim();
  }

  if (payload.content !== undefined) {
    if (!payload.content.trim()) throw new Error("Isi pengumuman wajib diisi.");
    updates.content = payload.content.trim();
  }

  if (payload.badge !== undefined) {
    updates.badge = payload.badge.trim() || null;
  }

  if (payload.isActive !== undefined) {
    updates.isActive = payload.isActive;
  }

  await updateDocWithDiagnostic(doc(db, "announcements", id), updates, "updateAnnouncement");
}

export async function deleteAnnouncement(id: string) {
  if (!db) throw new Error("Firebase is not configured.");
  if (!id) throw new Error("ID pengumuman tidak valid.");
  return deleteDocWithDiagnostic(doc(db, "announcements", id), "deleteAnnouncement");
}

export async function toggleAnnouncementStatus(id: string, currentStatus: boolean) {
  return updateAnnouncement(id, { isActive: !currentStatus });
}
