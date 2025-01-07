'use client'

import { ServerStatus } from "@/components/server-status"
import { SearchForm } from "@/components/search-form"
import { SearchResults } from "@/components/search-results"
import { useState } from "react"

export default function Home() {
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)

  const services = [
    { name: "Ollama", status: "running" as const },
    { name: "SearxNG", status: "running" as const },
    { name: "Supabase", status: "running" as const }
  ]

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-4xl font-bold text-center mb-8">Business Search</h1>
      <SearchForm onSearch={setSearchResults} onSearchingChange={setIsSearching} />
      <SearchResults results={searchResults} isLoading={isSearching} />
      <ServerStatus services={services} />
    </main>
  )
}
