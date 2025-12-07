"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { View } from "@instructure/ui-view";
import { Heading } from "@instructure/ui-heading";
import { Text } from "@instructure/ui-text";
import CourseNav from "../CourseNav";
import CourseHeader from "../CourseHeader";
import { Account, CourseModule, ModuleItem, fetchCourseModules } from "../../../../components/canvasApi";
import "../../../stylesheets/modules.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faFile, 
  faPenToSquare, 
  faQuestionCircle, 
  faComments, 
  faLink, 
  faCaretDown,
  faCaretRight
} from "@fortawesome/free-solid-svg-icons";

export default function ModulesPage() {
  const params = useParams();
  const accountDomain = params?.accountDomain as string;
  const courseIdStr = params?.courseId as string;
  const courseId = courseIdStr ? parseInt(courseIdStr, 10) : NaN;

  const [account, setAccount] = useState<Account | null>(null);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedModules, setCollapsedModules] = useState<Record<number, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("accounts");
      if (saved) {
        const accounts: Account[] = JSON.parse(saved);
        const found = accounts.find(a => a.domain === accountDomain) || null;
        setAccount(found);
        if (!found) setError("Account not found");
      } else { setError("No accounts saved"); }
    } catch { setError("Failed to parse accounts"); }
  }, [accountDomain]);

  useEffect(() => {
    if (!account || isNaN(courseId)) return;
    let cancelled = false; setLoading(true); setError(null);
    fetchCourseModules(account, courseId)
      .then(data => { if (!cancelled) setModules(Array.isArray(data) ? data : []); })
      .catch(e => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [account, courseId]);

  if (!accountDomain || isNaN(courseId)) return <Text>Invalid URL</Text>;

  const internalLinkForItem = (item: ModuleItem): string | null => {
    const type = item.type?.toLowerCase();
    if (!item.content_id && type !== 'external_url') return null;
    
    // Use relative navigation for assignments & files (one level up from /modules)
    if (type === 'assignment') return `./assignments/${item.content_id}`;
    if (type === 'discussion') return `./discussions/${item.content_id}`;
    if (type === 'page' && item.html_url) {
      // html_url like /courses/:course_id/pages/:slug
      const slugMatch = item.html_url.match(/\/pages\/(.+)$/);
      if (slugMatch) return `./pages/${slugMatch[1]}`;
    }
    if (type === 'file') return `./files/${item.content_id}`;
    if (type === 'external_url') return (item as any).external_url || null;
    
    return null;
  };

  const toggleModule = (moduleId: number) => {
    setCollapsedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const getIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'assignment': return faPenToSquare;
      case 'quiz': return faQuestionCircle;
      case 'file': return faFile;
      case 'page': return faFile;
      case 'discussion': return faComments;
      case 'external_url': return faLink;
      case 'sub_header': return null; 
      default: return faFile;
    }
  };

  return (
    <View as="div" padding="medium" width="100%">
      <CourseHeader />
      <CourseNav accountDomain={accountDomain} courseId={courseId} />
      
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <Heading level="h2" margin="0">Modules</Heading>
            <button 
                onClick={() => {
                    const allCollapsed = modules.every(m => collapsedModules[m.id]);
                    const newState: Record<number, boolean> = {};
                    modules.forEach(m => newState[m.id] = !allCollapsed);
                    setCollapsedModules(newState);
                }}
                style={{ background: "none", border: "1px solid #ccc", padding: "5px 10px", cursor: "pointer", borderRadius: "3px" }}
            >
                {modules.every(m => collapsedModules[m.id]) ? "Expand All" : "Collapse All"}
            </button>
        </div>

        {loading && <Text>Loading modules...</Text>}
        {!loading && error && <Text color="danger">{error}</Text>}
        {!loading && !error && modules.length === 0 && <Text>No modules found.</Text>}

        <div className="item-group-container">
            {modules.map(m => (
            <div key={m.id} className="item-group-condensed context_module">
                <div 
                    className={`ig-header ${collapsedModules[m.id] ? 'collapsed' : ''}`}
                    onClick={() => toggleModule(m.id)}
                >
                    <span className="ig-header-title">
                        <FontAwesomeIcon icon={collapsedModules[m.id] ? faCaretRight : faCaretDown} className="icon-mini-arrow-down" />
                        <span className="name">{m.name}</span>
                    </span>
                </div>
                
                {!collapsedModules[m.id] && (
                    <div className="content">
                        <ul className="ig-list">
                            {m.items?.map(it => {
                                const internal = internalLinkForItem(it);
                                const icon = getIcon(it.type);
                                const isSubHeader = it.type === 'SubHeader';
                                const indentClass = `indent_${it.indent || 0}`;

                                if (isSubHeader) {
                                    return (
                                        <li key={it.id} className={`context_module_item ${indentClass}`}>
                                            <div className="ig-row" style={{ background: "transparent", border: "none", paddingLeft: "10px" }}>
                                                <div className="ig-info">
                                                    <div className="module-item-title">
                                                        <span className="item_name" style={{ fontWeight: "bold", color: "#666" }}>
                                                            {it.title}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                }

                                return (
                                    <li key={it.id} className={`context_module_item ${indentClass}`}>
                                        <div className="ig-row">
                                            <span className="type_icon">
                                                {icon && <FontAwesomeIcon icon={icon} />}
                                            </span>
                                            <div className="ig-info">
                                                <div className="module-item-title">
                                                    <span className="item_name">
                                                        {internal ? (
                                                            <a href={internal} className="ig-title" target={it.type === 'external_url' ? "_blank" : "_self"}>
                                                                {it.title}
                                                            </a>
                                                        ) : (
                                                            <span className="ig-title" style={{ color: "#666" }}>{it.title}</span>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="ig-details">
                                                    {/* Placeholder for details like due date or points if available in API */}
                                                    {it.published === false && <span style={{color: "red"}}>Unpublished</span>}
                                                </div>
                                            </div>
                                            <div className="module-item-status-icon">
                                                {/* Status icons (checkmarks) could go here */}
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
            ))}
        </div>
      </div>
    </View>
  );
}
