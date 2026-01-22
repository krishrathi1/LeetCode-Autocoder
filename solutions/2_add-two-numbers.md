```python
from typing import List

class Solution:
    def addTwoNumbers(self, l1: Optional[ListNode], l2: Optional[ListNode]) -> Optional[ListNode]:
        dummy_head = ListNode(0)
        current = dummy_head
        carry = 0
        
        while l1 or l2:
            x = l1.val if l1 else 0
            y = l2.val if l2 else 0
            
            sum = carry + x + y
            carry = sum // 10
            val = sum % 10
            
            current.next = ListNode(val)
            current = current.next
            
            if l1: l1 = l1.next
            if l2: l2 = l2.next
        
        if carry > 0:
            current.next = ListNode(carry)
        
        return dummy_head.next
```

Note: `ListNode` is a standard data structure in LeetCode, representing a node in a singly linked list.