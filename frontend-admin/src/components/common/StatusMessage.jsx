export default function StatusMessage({ error, success }) {
  return <>{success ? <p className="form-success" role="status">{success}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}</>;
}
