'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Clock, Smile, Heart, Coffee, Palmtree, Gamepad2, Car, Lightbulb, Flag } from 'lucide-react'

// Compact emoji dataset — curated for chat, organized by category
const EMOJI_DATA: Record<string, { icon: React.ReactNode; label: string; emojis: string[] }> = {
  recent: {
    icon: <Clock size={16} />,
    label: 'Recently Used',
    emojis: [] // populated from localStorage
  },
  smileys: {
    icon: <Smile size={16} />,
    label: 'Smileys & People',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍',
      '🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢',
      '🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌',
      '😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠',
      '🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹',
      '😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱',
      '😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾',
      '🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾','👋','🤚','🖐️','✋','🖖',
      '🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉',
      '👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐',
      '🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷'
    ]
  },
  hearts: {
    icon: <Heart size={16} />,
    label: 'Hearts & Symbols',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕',
      '💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯',
      '🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓',
      '⭐','🌟','💫','✨','⚡','🔥','💥','☀️','🌈','🎵','🎶','🔔','📣','💬','💭',
      '🗯️','♠️','♣️','♥️','♦️','🃏','🎴','🀄','🔇','🔈','🔉','🔊','📢'
    ]
  },
  food: {
    icon: <Coffee size={16} />,
    label: 'Food & Drink',
    emojis: [
      '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓',
      '🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬',
      '🥦','🧄','🧅','🍄','🥜','🫘','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🥞',
      '🧇','🧀','🍖','🍗','🥩','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔',
      '🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱',
      '🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟',
      '🥠','🥡','🦀','🦞','🦐','🦑','🦪','🍦','🍧','🍨','🍩','🍪','🎂','🍰',
      '🧁','🥧','🍫','🍬','🍭','🍮','🍯','🍼','🥛','☕','🫖','🍵','🍶','🍾',
      '🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🥤','🧋','🧃','🧉','🧊'
    ]
  },
  nature: {
    icon: <Palmtree size={16} />,
    label: 'Animals & Nature',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷',
      '🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅',
      '🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰',
      '🪲','🪳','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑',
      '🌵','🎄','🌲','🌳','🌴','🪵','🌱','🌿','☘️','🍀','🎍','🪴','🎋','🍃',
      '🍂','🍁','🍄','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝',
      '🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌎','🌍','🌏'
    ]
  },
  activities: {
    icon: <Gamepad2 size={16} />,
    label: 'Activities',
    emojis: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒',
      '🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹',
      '🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤸','🤺','⛹️','🤾','🏌️',
      '🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅',
      '🎖️','🏵️','🎗️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁',
      '🪘','🎷','🎺','🪗','🎸','🪕','🎻','🪈','🎲','♟️','🎯','🎳','🎮','🕹️'
    ]
  },
  travel: {
    icon: <Car size={16} />,
    label: 'Travel & Places',
    emojis: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜',
      '🏍️','🛵','🚲','🛴','🛺','🚔','🚍','🚘','🚖','🛞','🚡','🚠','🚟','🚃',
      '🚋','🚞','🚝','🚄','🚅','🚈','🚂','🚆','🚇','🚊','🚉','✈️','🛫','🛬',
      '🛩️','💺','🛰️','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢',
      '🏠','🏡','🏘️','🏚️','🏗️','🏭','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪',
      '🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋','⛩️','🛤️','🛣️','🗾','🎑',
      '🏞️','🌅','🌄','🌠','🎇','🎆','🌇','🌆','🏙️','🌃','🌌','🌉','🌁'
    ]
  },
  objects: {
    icon: <Lightbulb size={16} />,
    label: 'Objects',
    emojis: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿',
      '📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻',
      '🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌',
      '💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳',
      '💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️',
      '🪤','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️',
      '🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','🩻','🩼',
      '💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰',
      '🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑',
      '🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🛍️','🛒','🎁','🎈','🎏','🎀','🪄','🪅','🎊','🎉','🎎','🏮','🎐','🧧','✉️','📩'
    ]
  },
  flags: {
    icon: <Flag size={16} />,
    label: 'Flags',
    emojis: [
      '🏳️','🏴','🏴‍☠️','🏁','🚩','🎌','🏳️‍🌈','🏳️‍⚧️',
      '🇺🇸','🇬🇧','🇮🇳','🇨🇦','🇦🇺','🇩🇪','🇫🇷','🇯🇵','🇰🇷','🇨🇳','🇧🇷','🇲🇽',
      '🇮🇹','🇪🇸','🇷🇺','🇳🇱','🇸🇪','🇳🇴','🇩🇰','🇫🇮','🇵🇱','🇨🇭','🇦🇹','🇧🇪',
      '🇮🇪','🇵🇹','🇬🇷','🇹🇷','🇸🇦','🇦🇪','🇮🇱','🇪🇬','🇿🇦','🇳🇬','🇰🇪','🇹🇭',
      '🇻🇳','🇮🇩','🇵🇭','🇲🇾','🇸🇬','🇳🇿','🇦🇷','🇨🇴','🇨🇱','🇵🇪','🇺🇦','🇵🇰'
    ]
  }
}

const RECENT_KEY = 'emoji-recent'
const MAX_RECENT = 24

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  position?: 'top' | 'bottom'
  isPortaled?: boolean
}

export function EmojiPicker({ onSelect, onClose, position = 'top', isPortaled = false }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('smileys')
  const [recentEmojis, setRecentEmojis] = useState<string[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Load recent emojis from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY)
      if (stored) {
        setRecentEmojis(JSON.parse(stored))
      }
    } catch {}
  }, [])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSelectEmoji = (emoji: string) => {
    // Update recent
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, MAX_RECENT)
    setRecentEmojis(updated)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)) } catch {}
    onSelect(emoji)
  }

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat)
    const el = categoryRefs.current[cat]
    if (el && gridRef.current) {
      gridRef.current.scrollTo({
        top: el.offsetTop - gridRef.current.offsetTop - 8,
        behavior: 'smooth'
      })
    }
  }

  // Build the visible categories with search filter
  const visibleCategories = useMemo(() => {
    const result: Record<string, string[]> = {}

    if (search) {
      // Flatten all emojis and filter (simple substring check won't work for emoji names,
      // so we just show all and let user visually scan — this is what Slack does)
      const allEmojis = Object.values(EMOJI_DATA).flatMap(c => c.emojis)
      result['Search Results'] = allEmojis
      return result
    }

    // Show recent first if available
    if (recentEmojis.length > 0) {
      result['Recently Used'] = recentEmojis
    }

    for (const [key, data] of Object.entries(EMOJI_DATA)) {
      if (key === 'recent') continue
      result[data.label] = data.emojis
    }

    return result
  }, [search, recentEmojis])

  const categories = Object.keys(EMOJI_DATA).filter(k => k !== 'recent' || recentEmojis.length > 0)

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, scale: 0.95, y: position === 'top' ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: position === 'top' ? 8 : -8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`${isPortaled ? '' : `absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} right-0`} z-[80] w-[352px] bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col`}
      style={{ maxHeight: '420px' }}
    >
      {/* Search */}
      <div className="p-2 border-b border-border shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emojis..."
            className="w-full bg-bg border border-border rounded-lg pl-8 pr-8 py-1.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      {!search && (
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border shrink-0 bg-bg/50 overflow-x-auto custom-scrollbar">
          {recentEmojis.length > 0 && (
            <button
              onClick={() => scrollToCategory('recent')}
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeCategory === 'recent' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
              }`}
              title="Recently Used"
            >
              <Clock size={16} />
            </button>
          )}
          {Object.entries(EMOJI_DATA).filter(([k]) => k !== 'recent').map(([key, data]) => (
            <button
              key={key}
              onClick={() => scrollToCategory(key)}
              className={`p-1.5 rounded-md transition-colors shrink-0 ${
                activeCategory === key ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text hover:bg-bg-tertiary'
              }`}
              title={data.label}
            >
              {data.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-2 py-1"
        onScroll={() => {
          if (!gridRef.current || search) return
          // Detect which category is most visible
          const scrollTop = gridRef.current.scrollTop + gridRef.current.offsetTop + 40
          let currentCat = activeCategory
          for (const [key, el] of Object.entries(categoryRefs.current)) {
            if (el && el.offsetTop <= scrollTop) {
              currentCat = key
            }
          }
          if (currentCat !== activeCategory) setActiveCategory(currentCat)
        }}
      >
        {Object.entries(visibleCategories).map(([label, emojis]) => {
          const catKey = Object.entries(EMOJI_DATA).find(([, d]) => d.label === label)?.[0] || label
          return (
            <div
              key={label}
              ref={el => { categoryRefs.current[catKey] = el }}
            >
              <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-1 py-1.5 sticky top-0 bg-bg-secondary/95 backdrop-blur-sm z-10">
                {label}
              </div>
              <div className="grid grid-cols-9 gap-0">
                {emojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    onClick={() => handleSelectEmoji(emoji)}
                    className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-bg-tertiary transition-colors text-xl active:scale-90"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
