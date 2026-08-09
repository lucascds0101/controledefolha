import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Pencil, Plus, Search, Trash2, CircleСheckPlaceholder } from "lucide-react";
export const Route = createFileRoute("/bloqueios")({ component: () => null });
