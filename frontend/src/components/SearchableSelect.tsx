import {
  Box,
  Input,
  InputGroup,
  InputRightElement,
  Popover,
  PopoverAnchor,
  PopoverBody,
  PopoverContent,
  Portal,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useMemo, useRef, useState } from "react";
import { FiChevronDown, FiX } from "react-icons/fi";

export type SearchableOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  emptyLabel?: string;
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Buscar...",
  emptyLabel = "Sin selección",
}: Props): JSX.Element {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((opt) => opt.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? options.filter((opt) => normalize(opt.label).includes(q))
      : options;
    return [{ value: "", label: emptyLabel }, ...list];
  }, [options, query, emptyLabel]);

  const open = () => {
    setQuery("");
    setHighlight(0);
    onOpen();
  };

  const close = () => {
    setQuery("");
    onClose();
  };

  const pick = (next: string) => {
    onChange(next);
    close();
    inputRef.current?.blur();
  };

  return (
    <Popover
      isOpen={isOpen}
      onClose={close}
      placement="bottom-start"
      autoFocus={false}
      matchWidth
      isLazy
    >
      <PopoverAnchor>
        <InputGroup>
          <Input
            ref={inputRef}
            value={isOpen ? query : (selected?.label ?? "")}
            placeholder={isOpen ? placeholder : emptyLabel}
            onFocus={open}
            onClick={() => !isOpen && open()}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
              if (!isOpen) onOpen();
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((h) => Math.min(h + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                const opt = filtered[highlight];
                if (opt) pick(opt.value);
              } else if (event.key === "Escape") {
                close();
              }
            }}
            onBlur={() => setTimeout(close, 150)}
            autoComplete="off"
          />
          <InputRightElement
            cursor="pointer"
            color="gray.500"
            onMouseDown={(event) => {
              event.preventDefault();
              if (value && !isOpen) {
                onChange("");
              } else if (isOpen) {
                close();
              } else {
                inputRef.current?.focus();
              }
            }}
          >
            {value && !isOpen ? <FiX /> : <FiChevronDown />}
          </InputRightElement>
        </InputGroup>
      </PopoverAnchor>
      <Portal>
        <PopoverContent
          _focus={{ boxShadow: "md" }}
          boxShadow="md"
          zIndex="popover"
        >
          <PopoverBody p={1} maxH="260px" overflowY="auto">
            {filtered.length === 1 && query.trim() ? (
              <Text px={3} py={2} fontSize="sm" color="gray.500">
                Sin resultados
              </Text>
            ) : null}
            {filtered.map((opt, index) => (
              <Box
                key={opt.value || "__empty"}
                px={3}
                py={1.5}
                fontSize="sm"
                rounded="md"
                cursor="pointer"
                bg={
                  index === highlight
                    ? "blue.50"
                    : opt.value === value
                      ? "gray.100"
                      : undefined
                }
                color={opt.value ? undefined : "gray.500"}
                fontWeight={opt.value === value ? "600" : undefined}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(opt.value);
                }}
              >
                {opt.label}
              </Box>
            ))}
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );
}
