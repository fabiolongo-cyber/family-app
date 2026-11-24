import { useFamily } from '../context.jsx'
import { Avatar, Icon, ScreenHeader } from '../ui.jsx'

const ROWS = [
  ['scadenze', 'wrench', 'Scadenze'],
  ['obiettivi', 'target', 'Obiettivi'],
  ['documenti', 'file', 'Documenti'],
  ['reminder', 'bell', 'Reminder'],
  ['impostazioni', 'settings', 'Impostazioni'],
]

export default function Altro({ go }) {
  const { members } = useFamily()
  return (
    <>
      <ScreenHeader title="Altro" subtitle="Famiglia" />
      <div className="content">
        <section className="card spread">
          <div>
            <div className="strong">{members.length} {members.length === 1 ? 'membro' : 'membri'}</div>
            <div className="muted small">{members.filter((m) => m.role === 'parent').length} genitori · {members.filter((m) => m.role !== 'parent').length} figli</div>
          </div>
          <div className="avatars">{members.map((m) => <Avatar key={m.uid} member={m} size={34} />)}</div>
        </section>
        <div className="card list">
          {ROWS.map(([key, icon, label]) => (
            <button key={key} type="button" className="menu-row" onClick={() => go('altro', key)}>
              <span className="menu-icon"><Icon name={icon} /></span>
              <span className="menu-label">{label}</span>
              <Icon name="next" size={20} />
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
