import { useEffect, useRef, type ReactNode } from "react";
import content from "./content.html?raw";
import portrait from "../../../assets/images/ramina_portrait.jpg";
import { initializeUmbraWidgets } from "./widgets";
import { UmbraLogo } from "./UmbraLogo";
import "../../styles/umbra.css";

// Trusted, local design markup. User data is rendered separately by React.
const markup = content.replace('src="ramina_portrait.jpg"', `src="${portrait}"`);

const navigation = [
  ["method", "Метод"], ["program", "Программа"], ["test", "Тест"],
  ["formats", "Форматы"], ["author", "Автор"]
];

export function UmbraLanding({ actions, authenticated }: { actions: ReactNode; authenticated: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => {
      header.parentElement?.style.setProperty("--umbra-header-height", `${header.offsetHeight + 16}px`);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (contentRef.current) initializeUmbraWidgets(contentRef.current);
    const previousTitle = document.title;
    document.title = "UMBRA — школа чёрной риторики";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="umbra-design" onClick={(event) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      const target = anchor && event.currentTarget.querySelector(anchor.hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    }}>
      <header ref={headerRef}>
        <div className="wrap nav">
          <a className="brand" href="#top" aria-label="UMBRA — на главную">
            <UmbraLogo />
            <b>UMBRA</b>
          </a>
          <nav aria-label="Основное меню">
            {navigation.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>
          {!authenticated ? actions : null}
        </div>
        {authenticated ? (
          <aside className="umbra-account-toolbar" aria-label="Управление аккаунтом">
            {actions}
          </aside>
        ) : null}
      </header>
      <div ref={contentRef} dangerouslySetInnerHTML={{ __html: markup }} />
    </div>
  );
}
