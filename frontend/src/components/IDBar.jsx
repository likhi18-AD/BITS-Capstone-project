// frontend/src/components/IDBar.jsx
export default function IDBar({ items }) {
  return (
    <div className="bg-bg-card/90 border border-slate-700/70 rounded-2xl p-4 shadow-soft-xl mt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-1">
            Registered IDs
          </p>
          <p className="text-[0.7rem] text-slate-500">
            Unique IDs assigned when vehicles were registered in this session.
          </p>
        </div>
      </div>

      {!items.length && (
        <p className="text-[0.7rem] text-slate-500">
          Register a vehicle to populate this ID bar.
        </p>
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="px-3 py-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/80 text-[0.7rem] text-slate-100 flex flex-col gap-0.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sky-300">{item.id}</span>
                {item.vehicleName && (
                  <span className="text-slate-400">· {item.vehicleName}</span>
                )}
              </div>
              <p className="text-[0.6rem] text-slate-500">
                {item.timestamp}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
