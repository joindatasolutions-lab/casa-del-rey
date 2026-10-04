const paths = {
  home: <><path d="m3 10 9-7 9 7v10H15v-7H9v7H3Z" /></>,
  people: <><circle cx="9" cy="7" r="3" /><path d="M2 21v-3a7 7 0 0 1 14 0v3ZM17 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6m10-6v6M3 11h18" /></>,
  book: <><path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v16" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 3" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>,
  new: <><circle cx="8" cy="7" r="3" /><path d="M2 21v-3a6 6 0 0 1 12 0v3m5-14v8m-4-4h8" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chart: <path d="M5 20v-5m7 5V9m7 11V3" />,
  edit: <><path d="m4 16 12-12 4 4L8 20l-5 1Zm9-9 4 4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-11v1" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
};
export default function Icon({ name, ...props }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.people}</svg>;
}
