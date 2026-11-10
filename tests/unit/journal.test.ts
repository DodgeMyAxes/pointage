import { describe, expect, it } from 'vitest'
import { analyserJournal, lireInstantUtc, requeteJournal } from '../../src/lib/journal'

const evenement = (fournisseur: string, id: number, horodatage: string) =>
  `<Event xmlns='http://schemas.microsoft.com/win/2004/08/events/event'><System><Provider Name='${fournisseur}' Guid='{x}'/>` +
  `<EventID>${id}</EventID><Version>0</Version><Level>4</Level><TimeCreated SystemTime='${horodatage}'/>` +
  `<EventRecordID>572165</EventRecordID><Channel>System</Channel><Computer>Tour</Computer></System>` +
  `<EventData><Data Name='TSId'>6</Data></EventData></Event>`

describe('journal Windows', () => {
  it('lit l’horodatage UTC à 7 décimales de Windows', () => {
    expect(lireInstantUtc('2026-11-08T10:42:00.8042052Z')).toBe(Date.UTC(2026, 10, 8, 10, 42, 0, 804))
    expect(lireInstantUtc('2026-11-08T10:42:00Z')).toBe(Date.UTC(2026, 10, 8, 10, 42))
    expect(lireInstantUtc('n’importe quoi')).toBeNull()
  })

  it('reconnaît les événements utiles et ignore les autres', () => {
    const xml = `<Events>${[
      evenement('Microsoft-Windows-Kernel-Boot', 27, '2026-11-08T07:10:17.1Z'),
      evenement('Microsoft-Windows-Power-Troubleshooter', 1, '2026-11-08T07:10:18.2Z'),
      evenement('Microsoft-Windows-Winlogon', 7001, '2026-11-08T07:12:00.0Z'),
      evenement('Microsoft-Windows-Kernel-Power', 107, '2026-11-08T07:10:19.0Z'),
      evenement('Microsoft-Windows-Kernel-General', 1, '2026-11-08T07:10:16.0Z'),
      evenement('Microsoft-Windows-Kernel-Power', 42, '2026-11-08T11:03:00.0Z'),
      evenement('User32', 1074, '2026-11-08T16:00:00.0Z'),
      evenement('Microsoft-Windows-Winlogon', 7002, '2026-11-08T16:00:05.0Z'),
      evenement('Microsoft-Windows-Kernel-General', 13, '2026-11-08T16:00:09.0Z'),
    ].join('')}</Events>`
    expect(analyserJournal(xml).map((e) => e.nature)).toEqual([
      'demarrage', 'reveil', 'ouverture', 'veille', 'arret', 'fermeture', 'arret',
    ])
  })

  it('écrit une requête XPath limitée dans le temps si demandé', () => {
    expect(requeteJournal()).not.toContain('TimeCreated')
    const q = requeteJournal(Date.UTC(2026, 10, 1))
    expect(q).toContain("TimeCreated[@SystemTime>='2026-11-01T00:00:00.000Z']")
    expect(q).toContain("(Provider[@Name='User32'] and (EventID=1074))")
    expect(q.startsWith('*[System[(')).toBe(true)
  })
})
