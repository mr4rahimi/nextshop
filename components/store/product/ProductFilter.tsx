type Props = {
  active: string
  setActive: (val: string) => void
}

export default function ProductFilter({ active, setActive }: Props) {

  const filters = ["all", "mobile", "laptop", "watch"]

  return (
    <div className="flex gap-2 p-1.5 bg-white/60 rounded-2xl">

      {filters.map(item => (
        <button
          key={item}
          onClick={() => setActive(item)}
          className={`px-6 py-2.5 rounded-xl text-xs font-black transition
            ${active === item ? "bg-primary-500 text-white" : "text-gray-500"}
          `}
        >
          {item}
        </button>
      ))}

    </div>
  )
}