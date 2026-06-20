"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/uikit/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckSquare, Plus, Loader2, Trash2, Circle, CheckCircle2, Clock, AlertCircle, PauseCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { DemoBanner } from "@/components/DemoBanner";
import {
  getTasks, addTask, updateTaskStatus, toggleTaskDone, deleteTask,
  type TaskRow as Task, type TaskPriority, type TaskStatus,
} from "@/app/actions/tasks";

const DEMO_TASKS: Task[] = [
  { id: "d1", title: "مهمة تجريبية ١", description: "وصف المهمة", priority: "عالية", status: "جارية", dueDate: null, done: false, createdAt: new Date().toISOString() },
  { id: "d2", title: "مهمة تجريبية ٢", description: "", priority: "متوسطة", status: "جديدة", dueDate: null, done: false, createdAt: new Date().toISOString() },
  { id: "d3", title: "مهمة تجريبية ٣", description: "", priority: "منخفضة", status: "مكتملة", dueDate: null, done: true, createdAt: new Date().toISOString() },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  "عالية": "bg-red-500/15 text-red-500",
  "متوسطة": "bg-amber-500/15 text-amber-500",
  "منخفضة": "bg-blue-500/15 text-blue-500",
};

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  "جديدة": Circle,
  "جارية": Clock,
  "مكتملة": CheckCircle2,
  "معلّقة": PauseCircle,
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  "جديدة": "text-muted-foreground",
  "جارية": "text-blue-500",
  "مكتملة": "text-emerald-500",
  "معلّقة": "text-amber-500",
};

const ALL_STATUSES: TaskStatus[] = ["جديدة", "جارية", "مكتملة", "معلّقة"];
const ALL_PRIORITIES: TaskPriority[] = ["عالية", "متوسطة", "منخفضة"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>("متوسطة");

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getTasks().then((r) => { if (alive) { setTasks(r.tasks); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const isDemo = !loading && tasks.length === 0;
  const source = isDemo ? DEMO_TASKS : tasks;
  const visible = filter === "all" ? source : source.filter((t) => t.status === filter);

  const counts: Record<string, number> = {
    all: source.length,
    جديدة: source.filter((t) => t.status === "جديدة").length,
    جارية: source.filter((t) => t.status === "جارية").length,
    مكتملة: source.filter((t) => t.status === "مكتملة").length,
    "معلّقة": source.filter((t) => t.status === "معلّقة").length,
  };

  const handleAdd = async () => {
    const title = titleRef.current?.value.trim();
    if (!title) { toast.error("عنوان المهمة مطلوب"); return; }
    setSaving(true);
    const res = await addTask({
      title,
      description: descRef.current?.value.trim(),
      priority,
      dueDate: dueRef.current?.value || undefined,
    });
    setSaving(false);
    if (!res.ok || !res.task) { toast.error(res.error || "تعذّرت الإضافة"); return; }
    setTasks((prev) => [res.task!, ...prev]);
    toast.success("تمت إضافة المهمة");
    setOpen(false);
    if (titleRef.current) titleRef.current.value = "";
    if (descRef.current) descRef.current.value = "";
    if (dueRef.current) dueRef.current.value = "";
    setPriority("متوسطة");
  };

  const handleToggle = async (id: string, done: boolean) => {
    if (isDemo) { toast.info("أضف مهام حقيقية أولاً"); return; }
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done, status: done ? "مكتملة" : "جارية" } : t));
    await toggleTaskDone(id, done);
  };

  const handleStatus = async (id: string, status: TaskStatus) => {
    if (isDemo) return;
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status, done: status === "مكتملة" } : t));
    await updateTaskStatus(id, status);
  };

  const handleDelete = async (id: string) => {
    if (isDemo) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTask(id);
    toast.info("تم حذف المهمة");
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {isDemo && <DemoBanner />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold flex items-center gap-2">
            <CheckSquare className="size-6 text-primary" /> إدارة المهام
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {counts["جارية"]} جارية · {counts["جديدة"]} جديدة · {counts["مكتملة"]} مكتملة
          </p>
        </div>
        <Button size="sm" className="mulki-gold-bg gap-1" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> إضافة مهمة
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent dir="rtl" className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مهمة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input ref={titleRef} placeholder="عنوان المهمة *" />
              <Input ref={descRef} placeholder="الوصف (اختياري)" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">الأولوية</label>
                  <div className="flex gap-1">
                    {ALL_PRIORITIES.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={cn(
                          "flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                          priority === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">تاريخ الاستحقاق</label>
                  <Input ref={dueRef} type="date" />
                </div>
              </div>
              <Button className="w-full" onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin ms-2" />}حفظ المهمة
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "جديدة", status: "جديدة" as TaskStatus, color: "text-muted-foreground", icon: Circle },
          { label: "جارية", status: "جارية" as TaskStatus, color: "text-blue-500", icon: Clock },
          { label: "مكتملة", status: "مكتملة" as TaskStatus, color: "text-emerald-500", icon: CheckCircle2 },
          { label: "معلّقة", status: "معلّقة" as TaskStatus, color: "text-amber-500", icon: PauseCircle },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className="mulki-card p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => setFilter(s.status)}
            >
              <Icon className={cn("size-5 mx-auto mb-1", s.color)} />
              <div className={cn("text-2xl font-bold mb-0.5", s.color)}>{counts[s.status]}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["all", ...ALL_STATUSES] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? `الكل (${counts.all})` : `${f} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {loading ? (
        <Card className="mulki-card p-12 text-center">
          <Loader2 className="size-8 text-primary mx-auto animate-spin" />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="mulki-card p-12 text-center">
          <CheckSquare className="size-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">لا توجد مهام في هذه الفئة.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => {
            const StatusIcon = STATUS_ICON[t.status];
            return (
              <Card key={t.id} className={cn("mulki-card p-4 transition-opacity", t.done && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggle(t.id, !t.done)}
                    className="mt-0.5 shrink-0"
                  >
                    {t.done
                      ? <CheckCircle2 className="size-5 text-emerald-500" />
                      : <Circle className="size-5 text-muted-foreground hover:text-primary transition-colors" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("font-medium text-sm", t.done && "line-through text-muted-foreground")}>{t.title}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", PRIORITY_COLOR[t.priority])}>
                        {t.priority}
                      </span>
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={cn("flex items-center gap-1 text-xs", STATUS_COLOR[t.status])}>
                        <StatusIcon className="size-3" />{t.status}
                      </span>
                      {t.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="size-3" />
                          {new Date(t.dueDate).toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isDemo && (
                      <select
                        value={t.status}
                        onChange={(e) => handleStatus(t.id, e.target.value as TaskStatus)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {!isDemo && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
