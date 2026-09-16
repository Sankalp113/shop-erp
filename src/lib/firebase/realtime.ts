'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection, doc, onSnapshot, query,
  QueryConstraint, DocumentData,
} from 'firebase/firestore'
import { db } from './config'

// ── useCollection ─────────────────────────────────────────────────────────────
// Real-time listener for a Firestore collection.
// Automatically unsubscribes when the component unmounts.
// Resubscribes whenever collectionPath or constraints change.

export function useCollection<T = any>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): { data: T[]; loading: boolean; error: string | null } {
  const [data, setData]       = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  // Stable key so we don't resubscribe on every render
  const key = constraints.map(c => JSON.stringify(c)).join('|')

  useEffect(() => {
    if (!collectionPath) { setLoading(false); return }
    setLoading(true)
    const q   = query(collection(db, collectionPath), ...constraints)
    const sub = onSnapshot(
      q,
      snap => {
        setData(snap.docs.map(d => ({ id: d.id, ...(d.data() as DocumentData) } as T)))
        setLoading(false)
        setError(null)
      },
      err => {
        console.error(`[useCollection] ${collectionPath}:`, err.message)
        setError(err.message)
        setLoading(false)
      }
    )
    return () => sub()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, key])

  return { data, loading, error }
}

// ── useDocument ───────────────────────────────────────────────────────────────
// Real-time listener for a single Firestore document.

export function useDocument<T = any>(
  collectionPath: string,
  docId: string | null | undefined
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData]       = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!collectionPath || !docId) { setLoading(false); return }
    setLoading(true)
    const sub = onSnapshot(
      doc(db, collectionPath, docId),
      snap => {
        setData(snap.exists() ? ({ id: snap.id, ...(snap.data() as DocumentData) } as T) : null)
        setLoading(false)
        setError(null)
      },
      err => {
        console.error(`[useDocument] ${collectionPath}/${docId}:`, err.message)
        setError(err.message)
        setLoading(false)
      }
    )
    return () => sub()
  }, [collectionPath, docId])

  return { data, loading, error }
}

// ── useRealtimeQuery ──────────────────────────────────────────────────────────
// Same as useCollection but accepts a pre-built Query object.
// Useful when constraints are built dynamically outside the hook.

export function useLiveCollection<T = any>(
  collectionPath: string,
  ...constraints: QueryConstraint[]
): { data: T[]; loading: boolean; error: string | null } {
  return useCollection<T>(collectionPath, constraints)
}
