import { describe, expect, it } from 'vitest'
import { parseBackup, serializeStore } from '../storage'
import type { PaperStore } from '../engine/types'

function makeStore(): PaperStore {
  return {
    version: 2,
    activeId: 'p_1',
    papers: [
      { id: 'p_1', title: '第一张', content: '1+1', updatedAt: 1000 },
      { id: 'p_2', title: '第二张', content: '2+2', updatedAt: 2000 },
    ],
  }
}

describe('备份 导出/导入 JSON', () => {
  it('roundtrip：导出后再导入，内容完整', () => {
    const json = serializeStore(makeStore())
    const papers = parseBackup(json)
    expect(papers).not.toBeNull()
    expect(papers).toHaveLength(2)
    expect(papers!.map((p) => p.title)).toEqual(['第一张', '第二张'])
    expect(papers!.map((p) => p.content)).toEqual(['1+1', '2+2'])
  })

  it('导入后重新分配 id，避免与现有冲突', () => {
    const papers = parseBackup(serializeStore(makeStore()))!
    expect(papers[0]!.id).not.toBe('p_1')
    expect(papers[0]!.id).not.toBe(papers[1]!.id)
  })

  it('非法 JSON 返回 null', () => {
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup('')).toBeNull()
  })

  it('结构不对返回 null', () => {
    expect(parseBackup('{"foo":1}')).toBeNull()
    expect(parseBackup('{"papers":[]}')).toBeNull()
    expect(parseBackup('{"papers":[{"title":123}]}')).toBeNull()
  })

  it('缺 title/content 的纸张被修复或跳过', () => {
    const papers = parseBackup(
      JSON.stringify({
        version: 2,
        papers: [
          { title: 'ok', content: '1' },
          { content: 'no title' },
          { title: 'no content' },
          42,
        ],
      }),
    )
    expect(papers).not.toBeNull()
    expect(papers).toHaveLength(2)
    expect(papers![0]!.title).toBe('ok')
    expect(papers![1]!.title).toBe('导入的算纸')
  })

  it('超长内容被截断', () => {
    const papers = parseBackup(
      JSON.stringify({
        version: 2,
        papers: [{ title: 'big', content: 'x'.repeat(300000) }],
      }),
    )!
    expect(papers[0]!.content.length).toBeLessThanOrEqual(200000)
  })
})
