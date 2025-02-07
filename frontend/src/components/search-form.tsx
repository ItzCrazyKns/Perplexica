import { Search } from "lucide-react"
import { useState } from "react"

interface SearchFormProps {
  onSearch: (results: any[]) => void;
  onSearchingChange: (isSearching: boolean) => void;
}

export function SearchForm({ onSearch, onSearchingChange }: SearchFormProps) {
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setError(null)
    onSearchingChange(true)
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim() }),
      })

      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()
      onSearch(data.results || [])
      
    } catch (error) {
      console.error("Search error:", error)
      onSearch([])
      setError("Failed to perform search. Please try again.")
    } finally {
      onSearchingChange(false)
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 mb-12">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="search" className="text-lg font-medium text-center">
            Find local businesses
          </label>
          <form onSubmit={handleSearch} className="relative">
            <input
              id="search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. plumbers in Denver, CO"
              className="w-full px-4 py-3 text-lg rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button 
              type="submit"
              disabled={!query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <p className="text-sm text-muted-foreground text-center mt-2">
            Try searching for: restaurants, dentists, electricians, etc.
          </p>
        </div>
      </div>
    </div>
  )
} 