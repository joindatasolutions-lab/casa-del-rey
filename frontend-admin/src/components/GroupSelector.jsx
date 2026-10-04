export default function GroupSelector({ groups, label = "Grupo", onChange, value }) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {groups.map((group) => (
          <option key={group.id_grupo} value={group.id_grupo}>
            {group.nombre_grupo}
          </option>
        ))}
      </select>
    </label>
  );
}
