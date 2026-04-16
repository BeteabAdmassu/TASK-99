import { parsePagination, buildPaginatedResponse } from '../../src/utils/pagination';

describe('parsePagination', () => {
  it('returns defaults when no params provided', () => {
    const result = parsePagination({});
    expect(result).toEqual({ skip: 0, take: 20, page: 1, limit: 20 });
  });

  it('parses valid page and limit', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result).toEqual({ skip: 20, take: 10, page: 3, limit: 10 });
  });

  it('accepts numeric values', () => {
    const result = parsePagination({ page: 2, limit: 50 });
    expect(result).toEqual({ skip: 50, take: 50, page: 2, limit: 50 });
  });

  it('clamps page below 1 to 1', () => {
    const result = parsePagination({ page: '0' });
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
  });

  it('clamps negative page to 1', () => {
    const result = parsePagination({ page: '-5' });
    expect(result.page).toBe(1);
  });

  it('treats limit 0 as default (falsy → default 20)', () => {
    const result = parsePagination({ limit: '0' });
    expect(result.limit).toBe(20);
    expect(result.take).toBe(20);
  });

  it('clamps limit above 100 to 100', () => {
    const result = parsePagination({ limit: '999' });
    expect(result.limit).toBe(100);
    expect(result.take).toBe(100);
  });

  it('treats NaN as default', () => {
    const result = parsePagination({ page: 'abc', limit: 'xyz' });
    expect(result).toEqual({ skip: 0, take: 20, page: 1, limit: 20 });
  });

  it('calculates skip correctly for page 5 limit 25', () => {
    const result = parsePagination({ page: '5', limit: '25' });
    expect(result.skip).toBe(100); // (5-1)*25
  });
});

describe('buildPaginatedResponse', () => {
  it('returns correct structure', () => {
    const items = [{ id: '1' }, { id: '2' }];
    const response = buildPaginatedResponse(items, 50, 1, 20);
    expect(response).toEqual({ data: items, total: 50, page: 1, limit: 20 });
  });

  it('handles empty data', () => {
    const response = buildPaginatedResponse([], 0, 1, 20);
    expect(response.data).toEqual([]);
    expect(response.total).toBe(0);
  });
});
