import { describe, expect, it } from 'vitest'
import { evaluateDoc } from '../evaluateDoc'

const MENU = `蒸蒸日上 128
重庆毛血旺 58
锅边馍 小 15
水煮牛肉 198
开胃泡菜 39
干拌红油抄手 48
红酱凉粉 22
米饭 18
酸梅汤 68`

describe('menu 594 (Soulver screenshot lock)', () => {
  it('total === 594', () => {
    const r = evaluateDoc(MENU)
    expect(r.lines.map((l) => l.value)).toEqual([
      128, 58, 15, 198, 39, 48, 22, 18, 68,
    ])
    expect(r.total).toBe(594)
  })
})

describe('evaluateDoc core', () => {
  it('arithmetic precedence', () => {
    expect(evaluateDoc('1+2*3').lines[0]!.value).toBe(7)
    expect(evaluateDoc('(1+2)*3').lines[0]!.value).toBe(9)
    expect(evaluateDoc('10/4').lines[0]!.value).toBe(2.5)
  })

  it('variables', () => {
    const r = evaluateDoc('x = 3\ny = x * 2')
    expect(r.lines[0]!.value).toBe(3)
    expect(r.lines[1]!.value).toBe(6)
    expect(r.variables.x).toBe(3)
    expect(r.variables.y).toBe(6)
  })

  it('chinese var quote', () => {
    const r = evaluateDoc('单价 = 89\n数量 = 3\n单价 * 数量')
    expect(r.lines[2]!.value).toBe(267)
    expect(r.total).toBe(89 + 3 + 267)
  })

  it('3万', () => {
    expect(evaluateDoc('3万').lines[0]!.value).toBe(30000)
  })

  it('1.2亿', () => {
    expect(evaluateDoc('1.2亿').lines[0]!.value).toBe(120000000)
  })

  it('100 打八折 → 80', () => {
    expect(evaluateDoc('100 打八折').lines[0]!.value).toBe(80)
  })

  it('100 打8折 → 80', () => {
    expect(evaluateDoc('100 打8折').lines[0]!.value).toBe(80)
  })

  it('50 + 10% → 55', () => {
    expect(evaluateDoc('50 + 10%').lines[0]!.value).toBe(55)
  })

  it('50 * 10% → 5', () => {
    expect(evaluateDoc('50 * 10%').lines[0]!.value).toBe(5)
  })

  it('empty and comment no value', () => {
    const r = evaluateDoc('\n// 备注\n')
    expect(r.lines.every((l) => l.value === undefined)).toBe(true)
    expect(r.total).toBe(0)
  })

  it('undefined var errors', () => {
    const r = evaluateDoc('z * 2')
    expect(r.lines[0]!.kind).toBe('error')
  })

  it('line refs #n', () => {
    const r = evaluateDoc('10\n20\n#1+#2')
    expect(r.lines[2]!.value).toBe(30)
  })

  it('assignment counts toward total', () => {
    const r = evaluateDoc('a = 10\nb = 20')
    expect(r.total).toBe(30)
  })
})
