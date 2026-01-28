export type SearchResultType =
  | 'student'
  | 'teacher'
  | 'lesson'
  | 'homework'
  | 'message'
  | 'material'
  | 'credit'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  subtitle?: string
  href: string
}

interface SearchParams {
  role: 'teacher' | 'student'
  query: string
}

export async function searchGlobal(_params: SearchParams): Promise<SearchResult[]> {
  return []
}
