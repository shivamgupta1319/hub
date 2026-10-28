export function Dashboard(): React.JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Your sites</h1>
      </header>
      <section className="empty" aria-labelledby="empty-title">
        <h2 id="empty-title">Nothing here yet</h2>
        <p>
          Add the websites you open every day, such as mail, chat or your project board. Each one
          gets an icon in the sidebar so you can switch with one click.
        </p>
      </section>
    </div>
  )
}
