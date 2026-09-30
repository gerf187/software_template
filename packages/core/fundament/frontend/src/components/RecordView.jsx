import PageHeader from "./PageHeader.jsx";
import PhaseBar from "./PhaseBar.jsx";
import Tabs from "./Tabs.jsx";

export default function RecordView({
  title,
  meta,
  actions,
  phases,
  activePhase,
  tabs,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="record-view">
      <PageHeader title={title} meta={meta} actions={actions} />
      {phases && <PhaseBar phases={phases} active={activePhase} />}
      <Tabs tabs={tabs} active={activeTab} onChange={onTabChange} />
      <div className="record-view-body">{children}</div>
    </div>
  );
}
