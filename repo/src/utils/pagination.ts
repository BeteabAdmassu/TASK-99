export function parsePagination(query: { page?: string | number; limit?: string | number }): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  let page = Number(query.page) || 1;
  let limit = Number(query.limit) || 20;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;

  const skip = (page - 1) * limit;
  return { skip, take: limit, page, limit };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): { data: T[]; total: number; page: number; limit: number } {
  return { data, total, page, limit };
}
