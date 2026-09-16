'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewPurchasePage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/purchases/history') }, [router])
  return null
}
