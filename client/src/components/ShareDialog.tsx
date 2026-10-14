import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Users, Copy, Check, Link2, Trash2, Crown, Loader2, RefreshCw } from "lucide-react";

interface ShareDialogProps {
  tripId: number;
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ tripId, open, onOpenChange }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();

  // 초대 링크 목록
  const { data: invites, isLoading: invitesLoading } = trpc.sharing.listInvites.useQuery(
    { tripId },
    { enabled: open }
  );

  // 멤버 목록
  const { data: membersData, isLoading: membersLoading } = trpc.sharing.listMembers.useQuery(
    { tripId },
    { enabled: open }
  );

  const isLoading = invitesLoading || membersLoading;

  const createInviteMutation = trpc.sharing.createInvite.useMutation({
    onSuccess: () => {
      utils.sharing.listInvites.invalidate({ tripId });
      toast.success("초대 링크가 생성되었습니다.");
    },
    onError: () => toast.error("초대 링크 생성에 실패했습니다."),
  });

  const deleteInviteMutation = trpc.sharing.deleteInvite.useMutation({
    onSuccess: () => {
      utils.sharing.listInvites.invalidate({ tripId });
      toast.success("초대 링크가 비활성화되었습니다.");
    },
    onError: () => toast.error("초대 링크 비활성화에 실패했습니다."),
  });

  const removeMemberMutation = trpc.sharing.removeMember.useMutation({
    onSuccess: () => {
      utils.sharing.listMembers.invalidate({ tripId });
      toast.success("멤버가 제거되었습니다.");
    },
    onError: () => toast.error("멤버 제거에 실패했습니다."),
  });

  // 가장 최신 초대 링크 사용
  const latestInvite = invites?.[invites.length - 1];
  const inviteLink = latestInvite
    ? `${window.location.origin}/join/${latestInvite.inviteToken}`
    : null;

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("링크가 복사되었습니다!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const members = membersData?.members ?? [];
  const ownerId = membersData?.ownerId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-xl p-5 sm:p-6">
        <DialogHeader className="mb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="w-4 h-4 text-primary" />
            여행 공유 관리
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            초대 링크를 공유하면 다른 사람과 함께 여행을 기록할 수 있습니다.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* 초대 링크 섹션 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">초대 링크</p>
              {inviteLink ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Input
                      readOnly
                      value={inviteLink}
                      className="border-0 bg-transparent p-0 h-auto text-xs font-mono text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5"
                      onClick={handleCopy}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "복사됨" : "링크 복사"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (latestInvite) deleteInviteMutation.mutate({ id: latestInvite.id });
                      }}
                      disabled={deleteInviteMutation.isPending}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      재발급
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 text-xs gap-1.5"
                  onClick={() => createInviteMutation.mutate({ tripId })}
                  disabled={createInviteMutation.isPending}
                >
                  {createInviteMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  초대 링크 생성
                </Button>
              )}
            </div>

            {/* 멤버 목록 */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                멤버 ({members.length}명)
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {members.map(member => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {((member.userName || member.userEmail || "?") as string)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {(member.userName as string) || (member.userEmail as string) || "알 수 없음"}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {member.userId === ownerId ? "소유자" : member.role === "editor" ? "편집자" : "뷰어"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {member.userId === ownerId ? (
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <button
                          onClick={() => removeMemberMutation.mutate({ tripId, userId: member.userId })}
                          disabled={removeMemberMutation.isPending}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    아직 공유된 멤버가 없습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 실시간 동기화 안내 */}
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/15">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                멤버가 참여하면 항공편, 렌트카, 숙박, 메모, 일정, 일기가 <strong className="text-foreground">실시간으로 동기화</strong>됩니다. 새로고침하면 최신 내용을 확인할 수 있습니다.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
