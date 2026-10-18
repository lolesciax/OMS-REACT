import { Component } from "react";

export default class PageErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="mx-auto my-12 w-full max-w-xl px-5">
          <div className="ui-empty" role="alert">
            <h1 className="mb-3 font-serif text-3xl">
              This page needs a refresh.
            </h1>
            <p>Check your connection, then reload to try again.</p>
            <button
              className="ui-button ui-button-dark"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
